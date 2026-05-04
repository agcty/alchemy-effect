import * as ag from "@distilled.cloud/aws/api-gateway";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Schedule from "effect/Schedule";
import { diffTags, normalizeTags } from "../../Tags.ts";

/**
 * API Gateway serializes mutations to a single RestApi at the control-plane
 * level: while the API is transitioning between states it responds with a
 * `BadRequestException` whose message matches one of:
 *
 * - `You cannot deploy a RestApi while the apiStatus is UPDATING or FAILED.`
 * - `There is already an update in progress.`
 *
 * These are fundamentally transient — the retry window is short (seconds)
 * and the only correct response is to wait and try again. Because the
 * exception is a 4xx, the generic `Retry.transient` policy applied to the
 * AWS SDK will not retry it, so we apply a targeted retry here for
 * operations that race with concurrent mutations on the same RestApi
 * (typically `createDeployment`, `updateStage`, `deleteStage`).
 */
const isApiStatusUpdatingError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  if ((error as { _tag?: string })._tag !== "BadRequestException") return false;
  const message = (error as { message?: string }).message ?? "";
  return (
    message.includes("apiStatus is UPDATING") ||
    message.includes("already an update in progress")
  );
};

/**
 * Retry schedule for `apiStatus is UPDATING` races. Fixed 2s delay with
 * jitter, capped at 15 attempts (~30s total). API Gateway typically
 * settles within a few seconds after a prior mutation; an unbounded
 * exponential schedule would blow past Vitest's 120s timeout if the race
 * ever failed to resolve, so we use spaced + recurs for predictable
 * bounds.
 */
const apiStatusUpdatingSchedule = pipe(
  Schedule.spaced(Duration.seconds(2)),
  Schedule.both(Schedule.recurs(15)),
  Schedule.addDelay(() =>
    Effect.succeed(Duration.millis(Math.random() * 500)),
  ),
);

/**
 * Wraps an API Gateway mutation so that 4xx responses indicating the
 * target RestApi is mid-update are retried with backoff. Drop-in usage:
 *
 * ```ts
 * yield* retryOnApiStatusUpdating(
 *   ag.createDeployment({ ... }),
 * );
 * ```
 */
export const retryOnApiStatusUpdating = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.retry(effect, {
    schedule: apiStatusUpdatingSchedule,
    while: isApiStatusUpdatingError,
  }) as Effect.Effect<A, E, R>;

export const restApiArn = (region: string, restApiId: string) =>
  `arn:aws:apigateway:${region}::/restapis/${restApiId}`;

export const stageArn = (
  region: string,
  restApiId: string,
  stageName: string,
) => `arn:aws:apigateway:${region}::/restapis/${restApiId}/stages/${stageName}`;

export const apiKeyArn = (region: string, apiKeyId: string) =>
  `arn:aws:apigateway:${region}::/apikeys/${apiKeyId}`;

export const usagePlanArn = (region: string, usagePlanId: string) =>
  `arn:aws:apigateway:${region}::/usageplans/${usagePlanId}`;

export const domainNameArn = (region: string, domainName: string) =>
  `arn:aws:apigateway:${region}::/domainnames/${domainName}`;

export const vpcLinkArn = (region: string, vpcLinkId: string) =>
  `arn:aws:apigateway:${region}::/vpclinks/${vpcLinkId}`;

export const syncTags = Effect.fn(function* ({
  resourceArn,
  oldTags,
  newTags,
}: {
  resourceArn: string;
  oldTags: Record<string, string>;
  newTags: Record<string, string>;
}) {
  const { removed, upsert } = diffTags(oldTags, newTags);
  if (removed.length > 0) {
    yield* ag
      .untagResource({
        resourceArn,
        tagKeys: removed,
      })
      .pipe(
        Effect.catchTag("NotFoundException", () => Effect.void),
        Effect.catchTag("BadRequestException", () => Effect.void),
      );
  }
  if (upsert.length > 0) {
    yield* ag.tagResource({
      resourceArn,
      tags: normalizeTags(upsert),
    });
  }
});
