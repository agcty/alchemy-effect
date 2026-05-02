import { Retry } from "@distilled.cloud/cloudflare";
import { isTransientError } from "@distilled.cloud/core/category";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Schedule from "effect/Schedule";

/**
 * Detect Cloudflare API errors that *look* permanent based on their _tag but
 * whose message reveals they're actually transient internal failures. The
 * underlying SDK marks the obvious 5xx-class errors (`InternalServerError`,
 * `BadGateway`, `ServiceUnavailable`, `GatewayTimeout`, `Locked`,
 * `TooManyRequests`) with the Retryable category, so {@link isTransientError}
 * already covers those. The cases below are NOT Retryable in the SDK
 * categorization but observably are transient when produced by Cloudflare:
 *
 * - `Forbidden` (Cloudflare error code `10001`) with message
 *   "We encountered an internal error. Please try again." — the global
 *   error map dispatches code `10001` to {@link Forbidden} even though the
 *   underlying issue is server-side.
 * - `WorkerNotFound` with message "An unknown error has occurred. If this
 *   error persists, please file a report in workers-sdk …" — the Workers
 *   API surfaces arbitrary 5xx-style failures as `WorkerNotFound`.
 * - `Unauthorized` with message "Authentication error" — sporadically
 *   returned for valid tokens during CF auth-edge blips.
 *
 * Discriminate by *message* so we never swallow real auth / not-found bugs
 * in an infinite retry loop.
 */
export const isMisleadingTransientCloudflareError = (
  error: unknown,
): boolean => {
  if (!error || typeof error !== "object") return false;
  const tag = (error as { _tag?: unknown })._tag;
  const message = String((error as { message?: unknown }).message ?? "");
  switch (tag) {
    case "Forbidden":
      return /internal error/i.test(message);
    case "WorkerNotFound":
      return /unknown error has occurred/i.test(message);
    case "Unauthorized":
      return /authentication error/i.test(message);
    default:
      return false;
  }
};

/**
 * Default alchemy Cloudflare retry policy. Extends
 * {@link transientOptions} (which retries SDK-categorized transient errors
 * indefinitely) with the misleadingly-tagged transient errors above and
 * caps to 5 attempts so a true outage still surfaces as a hard failure
 * rather than hanging the deploy.
 *
 * Built on top of the distilled-cloudflare {@link jittered} / {@link capped}
 * primitives so we share the same backoff shape as the rest of the SDK.
 */
export const cloudflareRetryOptions: Retry.Options = {
  while: (error: unknown) =>
    isTransientError(error) || isMisleadingTransientCloudflareError(error),
  schedule: pipe(
    Schedule.exponential(Duration.millis(250), 2),
    Retry.capped(Duration.seconds(5)),
    Retry.jittered,
    Schedule.both(Schedule.recurs(5)),
  ),
};

/**
 * Wrap a Cloudflare-using lifecycle effect with alchemy's default retry
 * policy. Apply at the outermost level of a provider's `create` / `update`
 * / `delete` / `read` body so transient API failures (5xx-class, throttling,
 * and the Cloudflare misleading-tag set documented in
 * {@link isMisleadingTransientCloudflareError}) are bounded-retried before
 * failing the lifecycle op.
 */
export const withRetry = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.retry(effect, cloudflareRetryOptions as never);
