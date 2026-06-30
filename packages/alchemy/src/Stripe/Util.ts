import * as Effect from "effect/Effect";
import * as Data from "effect/Data";
import * as Duration from "effect/Duration";
import * as Schedule from "effect/Schedule";
import { Stack } from "../Stack.ts";
import { Stage } from "../Stage.ts";
import { sha256 } from "../Util/sha256.ts";
import { stableStringify } from "../Util/stable.ts";

export type StripeMetadata = Record<string, string>;

const OWNERSHIP_STACK = "alchemy_stack";
const OWNERSHIP_STAGE = "alchemy_stage";
const OWNERSHIP_ID = "alchemy_id";
const OWNERSHIP_FINGERPRINT = "alchemy_fingerprint";

export interface Ownership {
  readonly stack: string;
  readonly stage: string;
  readonly id: string;
}

export const currentOwnership = (id: string, instanceId = id) =>
  Effect.gen(function* () {
    const stack = yield* Stack;
    const stage = yield* Stage;
    return {
      stack: stack.name,
      stage,
      id: instanceId,
    } satisfies Ownership;
  });

export const withOwnershipMetadata = (
  metadata: StripeMetadata | undefined,
  ownership: Ownership,
  options?: { readonly fingerprint?: string },
): StripeMetadata => ({
  ...(metadata ?? {}),
  [OWNERSHIP_STACK]: ownership.stack,
  [OWNERSHIP_STAGE]: ownership.stage,
  [OWNERSHIP_ID]: ownership.id,
  ...(options?.fingerprint === undefined
    ? {}
    : { [OWNERSHIP_FINGERPRINT]: options.fingerprint }),
});

export const stripOwnershipMetadata = (
  metadata: StripeMetadata,
): StripeMetadata => {
  const {
    [OWNERSHIP_STACK]: _stack,
    [OWNERSHIP_STAGE]: _stage,
    [OWNERSHIP_ID]: _id,
    [OWNERSHIP_FINGERPRINT]: _fingerprint,
    ...rest
  } = metadata;
  return rest;
};

export const metadataForUpdate = (
  current: StripeMetadata | undefined,
  desired: StripeMetadata,
): StripeMetadata => ({
  ...Object.fromEntries(
    Object.keys(current ?? {})
      .filter((key) => desired[key] === undefined)
      .map((key) => [key, ""]),
  ),
  ...desired,
});

export const isOwnedBy = (
  metadata: StripeMetadata,
  ownership: Ownership,
): boolean =>
  metadata[OWNERSHIP_STACK] === ownership.stack &&
  metadata[OWNERSHIP_STAGE] === ownership.stage &&
  metadata[OWNERSHIP_ID] === ownership.id;

export const isOwnedByStackStage = (
  metadata: StripeMetadata,
  ownership: Pick<Ownership, "stack" | "stage">,
): boolean =>
  metadata[OWNERSHIP_STACK] === ownership.stack &&
  metadata[OWNERSHIP_STAGE] === ownership.stage;

export const isStripeNotFound = (
  error: unknown,
): error is { readonly _tag: "NotFound" } =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  ((error as { readonly _tag?: unknown })._tag === "NotFound" ||
    ((error as { readonly _tag?: unknown })._tag === "InvalidRequestError" &&
      (error as { readonly code?: unknown }).code === "resource_missing"));

export const isStripeInvalidRequest = (
  error: unknown,
): error is { readonly _tag: "InvalidRequestError" } =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  (error as { readonly _tag?: unknown })._tag === "InvalidRequestError";

export const isStripeAlreadyExists = (
  error: unknown,
): error is {
  readonly _tag: "InvalidRequestError";
  readonly code?: string;
  readonly message?: string;
} => {
  if (!isStripeInvalidRequest(error)) return false;
  const code = (error as { readonly code?: unknown }).code;
  const message = (error as { readonly message?: unknown }).message;
  return (
    code === "resource_already_exists" ||
    (typeof message === "string" &&
      /already exists|already attached|already been attached/i.test(message))
  );
};

class StripeConsistencyPending extends Data.TaggedError(
  "StripeConsistencyPending",
)<{
  readonly resource: string;
}> {}

const stripeConsistencySchedule = Schedule.exponential(
  Duration.millis(100),
  1.5,
).pipe(Schedule.both(Schedule.recurs(5)));

const isStripeConsistencyPending = (
  error: unknown,
): error is { readonly _tag: "StripeConsistencyPending" } =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  (error as { readonly _tag?: unknown })._tag === "StripeConsistencyPending";

export const waitForStripeObserved = <A, E, R>(
  observe: Effect.Effect<A | undefined, E, R>,
  resource: string,
): Effect.Effect<A | undefined, E, R> =>
  observe.pipe(
    Effect.flatMap((value) =>
      value === undefined
        ? Effect.fail(new StripeConsistencyPending({ resource }))
        : Effect.succeed(value),
    ),
    Effect.retry({
      while: isStripeConsistencyPending,
      schedule: stripeConsistencySchedule,
    }),
    Effect.catchTag("StripeConsistencyPending", () =>
      Effect.succeed(undefined),
    ),
  );

export const createIdempotencyKey = (
  type: string,
  id: string,
  input: unknown,
) =>
  sha256(stableStringify({ id, input, type })).pipe(
    Effect.map((hash) => `alchemy:${type}:create:${hash.slice(0, 48)}`),
  );

export const createMetadataFingerprint = (input: unknown) =>
  sha256(stableStringify(input)).pipe(Effect.map((hash) => hash.slice(0, 32)));

export const getMetadataFingerprint = (
  metadata: StripeMetadata | undefined,
): string | undefined => metadata?.[OWNERSHIP_FINGERPRINT];

export const clearableStringForUpdate = (
  current: string | undefined,
  desired: string | undefined,
): string | undefined => desired ?? (current === undefined ? undefined : "");

export const clearableArrayForUpdate = <T>(
  current: readonly T[] | undefined,
  desired: readonly T[] | undefined,
): readonly T[] | "" | undefined =>
  desired ?? ((current?.length ?? 0) === 0 ? undefined : "");

export const clearableBooleanForUpdate = (
  current: boolean | undefined,
  desired: boolean | undefined,
): boolean | "" | undefined =>
  desired ?? (current === undefined ? undefined : "");

export const sortedStringsEqual = (
  left: readonly string[] | undefined,
  right: readonly string[] | undefined,
) => {
  const a = [...(left ?? [])].sort();
  const b = [...(right ?? [])].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
};

export const stripeObjectId = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof (value as { readonly id?: unknown }).id === "string"
  ) {
    return (value as { readonly id: string }).id;
  }
  return undefined;
};

export const defined = <T>(value: T | null | undefined): T | undefined =>
  value === null || value === undefined ? undefined : value;
