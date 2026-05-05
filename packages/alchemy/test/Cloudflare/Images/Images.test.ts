import * as Cloudflare from "@/Cloudflare";
import { inMemoryState } from "@/State";
import * as Stack from "@/Stack";
import { Stage } from "@/Stage";
import * as Test from "@/Test/Vitest";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const { test } = Test.make({ providers: Layer.empty });

const compileStack = <A, Err = never>(
  effect: Effect.Effect<A, Err, any>,
): Effect.Effect<Stack.CompiledStack<A>, Err> =>
  // @ts-expect-error - Stack.make's typing erases R unsoundly here
  effect.pipe(
    Stack.make({
      name: "test",
      providers: Layer.empty,
      state: inMemoryState(),
    }),
    Effect.provideService(Stage, "test"),
  );

test(
  "worker bindings emit Cloudflare Images metadata",
  Effect.gen(function* () {
    const stack = yield* Effect.gen(function* () {
      yield* Cloudflare.Worker("ImageWorker", {
        main: "./worker.ts",
        bindings: {
          MEDIA: Cloudflare.Images({ name: "IGNORED_BY_DIRECT_BINDING" }),
        },
      });
    }).pipe(compileStack);

    expect(stack.bindings.ImageWorker).toEqual([
      {
        sid: "MEDIA",
        data: {
          bindings: [
            {
              type: "images",
              name: "MEDIA",
            },
          ],
        },
      },
    ]);
  }),
);
