import * as Cloudflare from "@/Cloudflare";
import { CloudflareEnvironment } from "@/Cloudflare/CloudflareEnvironment";
import * as Test from "@/Test/Vitest";
import * as workers from "@distilled.cloud/cloudflare/workers";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as pathe from "pathe";

const { test } = Test.make({ providers: Cloudflare.providers() });
const main = pathe.resolve(import.meta.dirname, "fixtures/worker.ts");

type Expect<T extends true> = T;
type Extends<T, U> = T extends U ? true : false;
type RateLimitEnv = Cloudflare.InferEnv<{
  RATE_LIMIT: ReturnType<typeof Cloudflare.RateLimit>;
}>;
type RateLimitLimit = RateLimitEnv["RATE_LIMIT"]["limit"];
type _RateLimitBindingAcceptsKey = Expect<
  Extends<{ key: string }, Parameters<RateLimitLimit>[0]>
>;
type _RateLimitBindingReturnsPromise = Expect<
  Extends<ReturnType<RateLimitLimit>, Promise<unknown>>
>;

test.provider("worker bindings emit Cloudflare RateLimit metadata", (stack) =>
  Effect.gen(function* () {
    const { accountId } = yield* CloudflareEnvironment;

    yield* stack.destroy();

    const worker = yield* stack.deploy(
      Effect.gen(function* () {
        return yield* Cloudflare.Worker("RateLimitedWorker", {
          main,
          env: {
            SIGNUP_THROTTLE: Cloudflare.RateLimit({
              name: "IGNORED_BY_DIRECT_BINDING",
              namespaceId: 10_003,
              simple: { limit: 60, period: 60 },
            }),
          },
        });
      }),
    );

    const settings = yield* workers.getScriptScriptAndVersionSetting({
      accountId,
      scriptName: worker.workerName,
    });
    expect(settings.bindings).toEqual(
      expect.arrayContaining([
        {
          type: "ratelimit",
          name: "SIGNUP_THROTTLE",
          namespaceId: "10003",
          simple: {
            limit: 60,
            period: 60,
          },
        },
      ]),
    );

    yield* stack.destroy();
  }),
);

test.provider(
  "init-phase binding emits Cloudflare RateLimit metadata",
  (stack) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareEnvironment;

      yield* stack.destroy();

      const worker = yield* stack.deploy(
        Effect.gen(function* () {
          const rateLimit = yield* Cloudflare.RateLimit({
            name: "PUBLIC_SIGNUP_THROTTLE",
            namespaceId: "10004",
            simple: { limit: 1, period: 60 },
          });

          return yield* Cloudflare.Worker(
            "RateLimitedWorker",
            {
              main,
            },
            Effect.gen(function* () {
              yield* Cloudflare.RateLimit.bind(rateLimit);
            }).pipe(Effect.provide(Cloudflare.RateLimitBindingLive)),
          );
        }),
      );

      const settings = yield* workers.getScriptScriptAndVersionSetting({
        accountId,
        scriptName: worker.workerName,
      });
      expect(settings.bindings).toEqual(
        expect.arrayContaining([
          {
            type: "ratelimit",
            name: "PUBLIC_SIGNUP_THROTTLE",
            namespaceId: "10004",
            simple: {
              limit: 1,
              period: 60,
            },
          },
        ]),
      );

      yield* stack.destroy();
    }),
);
