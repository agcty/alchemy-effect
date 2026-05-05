import * as Effect from "effect/Effect";
import { RateLimitBinding } from "./RateLimitBinding.ts";

type RateLimitTypeId = typeof RateLimitTypeId;
const RateLimitTypeId = "Cloudflare.RateLimit" as const;

export type RateLimitPeriod = 10 | 60;

export type RateLimitProps = {
  /**
   * Binding name used when `Cloudflare.RateLimit.bind(rateLimit)` attaches the
   * binding from inside a Worker init phase. When RateLimit is passed through
   * `Worker({ bindings: { ... } })`, the object key remains the binding name.
   *
   * @default "RATE_LIMIT"
   */
  name?: string;
  /**
   * Positive integer or string that uniquely identifies this rate limit
   * configuration.
   */
  namespaceId: number | string;
  /**
   * Simple rate limiting configuration.
   */
  simple: {
    /**
     * The number of requests allowed within the period.
     */
    limit: number;
    /**
     * The period, in seconds, over which requests are counted.
     */
    period: RateLimitPeriod;
  };
};

export type RateLimit = {
  kind: RateLimitTypeId;
  name: string;
  namespaceId: string;
  simple: {
    limit: number;
    period: RateLimitPeriod;
  };
};

export const isRateLimit = (value: unknown): value is RateLimit =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  (value as RateLimit).kind === RateLimitTypeId;

/**
 * A Cloudflare Rate Limit binding for counting arbitrary keys inside Workers.
 *
 * Rate Limit bindings are configured directly on Workers and do not have a
 * standalone provisioning API. The Worker provider sees this object in
 * `bindings: { ... }` and emits the corresponding `{ type: "ratelimit" }`
 * metadata binding to the script.
 *
 * @section Declaring a Rate Limit
 * @example
 * ```typescript
 * const signupThrottle = yield* Cloudflare.RateLimit({
 *   namespaceId: 1001,
 *   simple: { limit: 10, period: 60 },
 * });
 * ```
 *
 * @section Binding to a Worker
 * @example
 * ```typescript
 * export const Worker = Cloudflare.Worker("Worker", {
 *   main: "./src/worker.ts",
 *   bindings: { SIGNUP_THROTTLE: signupThrottle },
 * });
 *
 * export type WorkerEnv = Cloudflare.InferEnv<typeof Worker>;
 * //   { SIGNUP_THROTTLE: RateLimit }
 * ```
 *
 * @section Effect-style Worker
 * @example
 * ```typescript
 * Cloudflare.Worker("Worker", props, Effect.gen(function* () {
 *   const signupThrottle = yield* Cloudflare.RateLimit.bind(SignupThrottle);
 * }).pipe(Effect.provide(Cloudflare.RateLimitBindingLive)));
 * ```
 *
 * @see https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
 */
export const RateLimit: {
  (props: RateLimitProps): Effect.Effect<RateLimit>;
  /**
   * Bind Cloudflare Rate Limit to the surrounding Worker, returning an
   * Effect-native client with access to the native Workers runtime binding.
   */
  bind: typeof RateLimitBinding.bind;
} = Object.assign(
  Effect.fn(function* (props: RateLimitProps) {
    return {
      kind: RateLimitTypeId,
      name: props.name ?? "RATE_LIMIT",
      namespaceId: String(props.namespaceId),
      simple: {
        limit: props.simple.limit,
        period: props.simple.period,
      },
    } satisfies RateLimit;
  }),
  {
    bind: (...args: Parameters<typeof RateLimitBinding.bind>) =>
      RateLimitBinding.bind(...args),
  },
);
