import * as Effect from "effect/Effect";
import { Unowned } from "../AdoptPolicy.ts";
import { deepEqual, isResolved } from "../Diff.ts";
import * as Provider from "../Provider.ts";
import { Resource } from "../Resource.ts";
import { StripeClient, type StripeFeature } from "./Client.ts";
import { InactiveFeatureError, ResourceNotOwnedError } from "./Errors.ts";
import type { Providers } from "./Providers.ts";
import {
  currentOwnership,
  createIdempotencyKey,
  isOwnedBy,
  isStripeNotFound,
  metadataForUpdate,
  stripOwnershipMetadata,
  type StripeMetadata,
  withOwnershipMetadata,
} from "./Util.ts";

export interface FeatureProps {
  /**
   * Stripe Entitlements lookup key. This is the product-facing feature key
   * that later appears in active entitlement summaries.
   */
  readonly lookupKey: string;
  readonly name: string;
  readonly metadata?: StripeMetadata;
}

export interface FeatureAttributes {
  readonly id: string;
  readonly lookupKey: string;
  readonly name: string;
  readonly active: boolean;
  readonly metadata: StripeMetadata;
  readonly livemode: boolean;
}

export type Feature = Resource<
  "Stripe.Feature",
  FeatureProps,
  FeatureAttributes,
  never,
  Providers
>;

/**
 * A Stripe Entitlements Feature.
 *
 * Features describe product capabilities. They do not grant access by
 * themselves; attach them to catalog products with `Stripe.ProductFeature`.
 * Runtime entitlement reconciliation belongs in `@oddlynew/stripe`, while
 * this resource only manages Stripe catalog configuration.
 *
 * Stripe does not expose a feature delete API, and inactive features cannot be
 * attached to products again. Features are retained by default so a later
 * deploy can adopt the active feature by lookup key.
 *
 * @resource
 * @see https://docs.stripe.com/api/entitlements/feature
 */
export const Feature = Resource<Feature>("Stripe.Feature", {
  defaultRemovalPolicy: "retain",
});

const toAttributes = (feature: StripeFeature): FeatureAttributes => ({
  id: feature.id,
  lookupKey: feature.lookup_key,
  name: feature.name,
  active: feature.active,
  metadata: stripOwnershipMetadata(feature.metadata),
  livemode: feature.livemode,
});

const findByLookupKey = (lookupKey: string) =>
  Effect.gen(function* () {
    const client = yield* StripeClient;
    const features = yield* client.listFeatures({ lookup_key: lookupKey });
    return features.find((feature) => feature.lookup_key === lookupKey);
  });

const rejectInactiveFeature = (feature: StripeFeature) =>
  feature.active
    ? Effect.succeed(feature)
    : Effect.fail(
        new InactiveFeatureError({
          featureId: feature.id,
          message: `Stripe feature '${feature.id}' is inactive and cannot be managed as an active feature.`,
        }),
      );

export const FeatureProvider = () =>
  Provider.effect(
    Feature,
    Effect.gen(function* () {
      const client = yield* StripeClient;

      const updateFeature = (
        featureId: string,
        props: FeatureProps,
        currentMetadata: StripeMetadata | undefined,
        metadata: StripeMetadata,
      ) =>
        client.updateFeature({
          id: featureId,
          metadata: metadataForUpdate(currentMetadata, metadata),
          name: props.name,
        });

      return {
        stables: ["id", "lookupKey", "livemode"],
        list: Effect.fn(function* () {
          const features = yield* client.listFeatures();
          return features
            .filter(
              (feature) =>
                feature.metadata.alchemy_stack !== undefined && feature.active,
            )
            .map(toAttributes);
        }),
        diff: Effect.fn(function* ({ olds, news }) {
          if (!isResolved(news)) return undefined;
          if (olds?.lookupKey !== news.lookupKey)
            return { action: "replace" } as const;
          return deepEqual(olds, news)
            ? undefined
            : ({ action: "update" } as const);
        }),
        reconcile: Effect.fn(function* ({ id, fqn, news, output }) {
          const ownership = yield* currentOwnership(id, fqn);
          const metadata = withOwnershipMetadata(news.metadata, ownership);
          const observed = output?.id
            ? yield* client
                .getFeature(output.id)
                .pipe(
                  Effect.catchIf(isStripeNotFound, () =>
                    Effect.succeed(undefined),
                  ),
                )
            : yield* findByLookupKey(news.lookupKey);

          if (observed === undefined) {
            const createInput = {
              lookup_key: news.lookupKey,
              name: news.name,
              metadata,
            };
            const created = yield* client.createFeature(createInput, {
              idempotencyKey: yield* createIdempotencyKey(
                "feature",
                id,
                createInput,
              ),
            });
            return toAttributes(created);
          }
          if (
            output === undefined &&
            !isOwnedBy(observed.metadata, ownership)
          ) {
            return yield* Effect.fail(
              new ResourceNotOwnedError({
                resourceType: "Stripe.Feature",
                resourceId: observed.id,
                message: `Stripe feature '${observed.id}' exists but is not owned by this stack.`,
              }),
            );
          }
          const activeObserved = yield* rejectInactiveFeature(observed);

          return yield* updateFeature(
            activeObserved.id,
            news,
            activeObserved.metadata,
            metadata,
          ).pipe(Effect.map(toAttributes));
        }),
        read: Effect.fn(function* ({ id, fqn, olds, output }) {
          const feature = output?.id
            ? yield* client
                .getFeature(output.id)
                .pipe(
                  Effect.catchIf(isStripeNotFound, () =>
                    Effect.succeed(undefined),
                  ),
                )
            : yield* findByLookupKey(olds.lookupKey);
          if (!feature) return undefined;

          const attrs = toAttributes(feature);
          const ownership = yield* currentOwnership(id, fqn);
          if (!isOwnedBy(feature.metadata, ownership)) return Unowned(attrs);
          const activeFeature = yield* rejectInactiveFeature(feature);
          return toAttributes(activeFeature);
        }),
        delete: Effect.fn(function* ({ output }) {
          yield* client
            .updateFeature({
              id: output.id,
              active: false,
            })
            .pipe(
              Effect.asVoid,
              Effect.catchIf(isStripeNotFound, () => Effect.void),
            );
        }),
      };
    }),
  );
