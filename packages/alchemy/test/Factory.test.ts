import {
  FACTORY_ARG_COUNT_KEY,
  FACTORY_MARKER,
  factoryArgKey,
  makeFactory,
} from "@/Factory.ts";
import * as Output from "@/Output.ts";
import { Resource } from "@/Resource.ts";
import * as Stack from "@/Stack.ts";
import { Stage } from "@/Stage.ts";
import { InMemoryService, inMemoryState, State } from "@/State";
import * as Test from "@/Test/Vitest";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { Bucket, TestLayers } from "./test.resources.ts";

const freshState = Layer.effect(
  State,
  Effect.sync(() => InMemoryService({})),
);

const { test } = Test.make({
  providers: TestLayers(),
  state: freshState,
});

// Inline test resource with an open-ended `env: Record<string, unknown>`
// so we can inspect what the factory writes into Props.env without
// fighting the typed env shapes on the production resources.
interface FactoryProbe
  extends Resource<
    "Test.FactoryProbe",
    { env?: Record<string, unknown> },
    { name: string }
  > {}
const FactoryProbe = Resource<FactoryProbe>("Test.FactoryProbe");

const runInStack = <A>(eff: Effect.Effect<A, any, any>): Effect.Effect<A> =>
  eff.pipe(
    Stack.make({
      name: "test-factory",
      providers: Layer.empty as any,
      state: inMemoryState() as any,
    }) as any,
    Effect.provideService(Stage, "test"),
    Effect.map((compiled: any) => compiled.output as A),
    Effect.provide(TestLayers()),
    Effect.scoped,
  ) as Effect.Effect<A>;

describe("factory form", () => {
  test(
    "marker and Type are exposed on the wrapper",
    Effect.gen(function* () {
      const Factory = Bucket((name: string) => ["Probe", { name }]);
      expect((Factory as any)[FACTORY_MARKER]).toBe(true);
      // Resource (non-Platform) wrappers don't carry Type — only the
      // Platform overload pins it. Sanity-check we don't accidentally
      // leak undefined onto the function.
      expect(typeof Factory).toBe("function");
    }),
  );

  test(
    "plain args are JSON-encoded into Props.env",
    Effect.gen(function* () {
      const Factory: (...args: any[]) => Effect.Effect<unknown> = FactoryProbe(
        (_region: string, _count: number, _opts: { strict: boolean }) => [
          "Probe",
          {},
        ] as const,
      );
      const probe = yield* Factory("us-east-1", 3, { strict: true }).pipe(
        runInStack,
      );
      const env = (probe as any).Props.env as Record<string, unknown>;
      expect(env[FACTORY_ARG_COUNT_KEY]).toBe("3");
      expect(env[factoryArgKey(0)]).toBe(JSON.stringify("us-east-1"));
      expect(env[factoryArgKey(1)]).toBe(JSON.stringify(3));
      expect(env[factoryArgKey(2)]).toBe(JSON.stringify({ strict: true }));
    }),
  );

  test(
    "Redacted args are wrapped with the _tag marker so the lifecycle binds them as secret_text",
    Effect.gen(function* () {
      const Factory: (...args: any[]) => Effect.Effect<unknown> = FactoryProbe(
        (_token: Redacted.Redacted<string>) => ["Probe", {}] as const,
      );
      const secret = Redacted.make("super-secret");
      const probe = yield* Factory(secret).pipe(runInStack);
      const env = (probe as any).Props.env as Record<string, unknown>;
      const encoded = env[factoryArgKey(0)];
      // Stays Redacted — the env-binding lifecycle (Worker.ts) checks
      // Redacted.isRedacted to choose secret_text vs plain_text.
      expect(Redacted.isRedacted(encoded)).toBe(true);
      // The inner string is the JSON-with-marker the runtime decodes.
      expect(JSON.parse(Redacted.value(encoded as Redacted.Redacted<string>))).toEqual({
        _tag: "Redacted",
        value: "super-secret",
      });
    }),
  );

  test(
    "Output args are passed through as Output so the engine resolves them at deploy time",
    Effect.gen(function* () {
      const Factory: (...args: any[]) => Effect.Effect<unknown> = FactoryProbe(
        (_upstream: Output.Output<string>) => ["Probe", {}] as const,
      );
      const probe = yield* Factory(Output.literal("from-upstream")).pipe(
        runInStack,
      );
      const env = (probe as any).Props.env as Record<string, unknown>;
      // The engine hasn't resolved Outputs at this layer yet (we
      // bypassed Plan/Apply), so the slot still holds an Output. The
      // important invariant is just that the factory didn't pre-stringify
      // the Output itself — the resolver will JSON-stringify the
      // resolved string when it runs.
      expect(Output.isOutput(env[factoryArgKey(0)])).toBe(true);
    }),
  );

  test(
    "decode round-trip rebuilds Redacted and primitives",
    Effect.gen(function* () {
      // Mirrors the decode block emitted into the generated worker
      // entrypoint — a regression here means the runtime decode and
      // the deploy-time encode have drifted.
      const decode = (raw: unknown) => {
        if (raw == null) return raw;
        const text = typeof raw === "string" ? raw : String(raw);
        try {
          const parsed = JSON.parse(text);
          if (
            parsed !== null &&
            typeof parsed === "object" &&
            parsed._tag === "Redacted" &&
            "value" in parsed
          ) {
            return Redacted.make(parsed.value);
          }
          return parsed;
        } catch {
          return text;
        }
      };

      const Factory: (...args: any[]) => Effect.Effect<unknown> = FactoryProbe(
        (_a: string, _b: Redacted.Redacted<string>, _c: { n: number }) => [
          "Probe",
          {},
        ] as const,
      );
      const probe = yield* Factory("hello", Redacted.make("hide-me"), {
        n: 7,
      }).pipe(runInStack);
      const env = (probe as any).Props.env as Record<string, unknown>;

      // Cloudflare hands plain_text bindings back as strings and
      // secret_text bindings back as strings too — both arrive as
      // strings at runtime regardless of how they were tagged. Mimic
      // that by unwrapping any Redacted wrapper before decoding.
      const flatten = (raw: unknown): unknown =>
        Redacted.isRedacted(raw)
          ? Redacted.value(raw as Redacted.Redacted<string>)
          : raw;

      expect(decode(flatten(env[factoryArgKey(0)]))).toBe("hello");
      const rebuiltSecret = decode(flatten(env[factoryArgKey(1)]));
      expect(Redacted.isRedacted(rebuiltSecret)).toBe(true);
      expect(Redacted.value(rebuiltSecret as Redacted.Redacted<string>)).toBe(
        "hide-me",
      );
      expect(decode(flatten(env[factoryArgKey(2)]))).toEqual({ n: 7 });
    }),
  );

  test(
    "makeFactory wraps a custom function with the marker",
    Effect.gen(function* () {
      const inner = (x: string) =>
        Effect.gen(function* () {
          return { Props: { env: {} } } as any;
        });
      const wrapped = makeFactory(inner);
      expect((wrapped as any)[FACTORY_MARKER]).toBe(true);
      const result = yield* wrapped("hi");
      expect((result as any).Props.env[FACTORY_ARG_COUNT_KEY]).toBe("1");
      expect((result as any).Props.env[factoryArgKey(0)]).toBe(
        JSON.stringify("hi"),
      );
    }),
  );
});
