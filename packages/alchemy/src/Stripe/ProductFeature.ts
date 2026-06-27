import * as Effect from "effect/Effect";
import { Unowned } from "../AdoptPolicy.ts";
import { isResolved } from "../Diff.ts";
import * as Provider from "../Provider.ts";
import { Resource } from "../Resource.ts";
import {
  StripeClient,
  type StripeFeature,
  type StripeProductFeature,
} from "./Client.ts";
import {
  FeatureNotFoundError,
  InactiveFeatureAttachmentError,
  ResourceNotOwnedError,
} from "./Errors.ts";
import type { Providers } from "./Providers.ts";
import {
  currentOwnership,
  createIdempotencyKey,
  isOwnedByStackStage,
  isStripeNotFound,
} from "./Util.ts";

export interface ProductFeatureProps {
  /**
   * Stripe product id.
   */
  readonly product: string;
  /**
   * Stripe Entitlements feature id or lookup key.
   */
  readonly feature: string;
}

export interface ProductFeatureAttributes {
  readonly id: string;
  readonly product: string;
  readonly featureId: string;
  readonly featureLookupKey: string;
  readonly featureName: string;
  readonly featureActive: boolean;
  readonly livemode: boolean;
}

export type ProductFeature = Resource<
  "Stripe.ProductFeature",
  ProductFeatureProps,
  ProductFeatureAttributes,
  never,
  Providers
>;

/**
 * A Stripe Product Feature attachment.
 *
 * This attaches an Entitlements Feature to a Product so subscriptions to that
 * product produce active entitlement summaries. The feature itself can be
 * referenced by id or lookup key for ergonomics.
 *
 * @resource
 * @see https://docs.stripe.com/api/product-feature
 */
export const ProductFeature = Resource<ProductFeature>("Stripe.ProductFeature");

const toAttributes = (
  product: string,
  feature: StripeProductFeature,
): ProductFeatureAttributes => ({
  id: feature.id,
  product,
  featureId: feature.entitlement_feature.id,
  featureLookupKey: feature.entitlement_feature.lookup_key,
  featureName: feature.entitlement_feature.name,
  featureActive: feature.entitlement_feature.active,
  livemode: feature.livemode,
});

const resolveFeature = (feature: string) =>
  Effect.gen(function* () {
    const client = yield* StripeClient;
    const byLookupKey = client.listFeatures({ lookup_key: feature }).pipe(
      Effect.flatMap((features) => {
        const found = features.find((row) => row.lookup_key === feature);
        return found
          ? Effect.succeed(found)
          : Effect.fail(
              new FeatureNotFoundError({
                feature,
                message: `Stripe feature '${feature}' was not found.`,
              }),
            );
      }),
    );
    return yield* feature.startsWith("feat_")
      ? client
          .getFeature(feature)
          .pipe(Effect.catchIf(isStripeNotFound, () => byLookupKey))
      : byLookupKey;
  });

const findAttachment = (product: string, feature: StripeFeature) =>
  Effect.gen(function* () {
    const client = yield* StripeClient;
    const attachments = yield* client.listProductFeatures(product);
    return attachments.find((row) => row.entitlement_feature.id === feature.id);
  });

const stackOwnsAttachment = (
  logicalId: string,
  instanceId: string,
  productId: string,
  feature: StripeFeature,
) =>
  Effect.gen(function* () {
    const client = yield* StripeClient;
    const ownership = yield* currentOwnership(logicalId, instanceId);
    const product = yield* client
      .getProduct(productId)
      .pipe(Effect.catchIf(isStripeNotFound, () => Effect.succeed(undefined)));
    return (
      product !== undefined &&
      isOwnedByStackStage(product.metadata, ownership) &&
      isOwnedByStackStage(feature.metadata, ownership)
    );
  });

export const ProductFeatureProvider = () =>
  Provider.effect(
    ProductFeature,
    Effect.gen(function* () {
      const client = yield* StripeClient;

      return {
        stables: ["id", "product", "featureId", "livemode"],
        list: Effect.fn(function* () {
          const products = yield* client.listProducts();
          const productFeatures = yield* Effect.forEach(
            products.filter(
              (product) => product.metadata.alchemy_stack !== undefined,
            ),
            (product) =>
              client.listProductFeatures(product.id).pipe(
                Effect.map((features) =>
                  features.map((feature) => toAttributes(product.id, feature)),
                ),
                Effect.catchIf(isStripeNotFound, () => Effect.succeed([])),
              ),
            { concurrency: "unbounded" },
          );
          return productFeatures.flat();
        }),
        diff: Effect.fn(function* ({ olds, news }) {
          if (!isResolved(news)) return undefined;
          return olds?.product === news.product && olds.feature === news.feature
            ? undefined
            : ({ action: "replace" } as const);
        }),
        reconcile: Effect.fn(function* ({ id, instanceId, news, output }) {
          const feature = yield* resolveFeature(news.feature);
          if (!feature.active) {
            return yield* Effect.fail(
              new InactiveFeatureAttachmentError({
                featureId: feature.id,
                message: `Stripe feature '${feature.id}' is inactive and cannot be attached.`,
              }),
            );
          }
          const observed = output?.id
            ? yield* client
                .getProductFeature(news.product, output.id)
                .pipe(
                  Effect.catchIf(isStripeNotFound, () =>
                    Effect.succeed(undefined),
                  ),
                )
            : yield* findAttachment(news.product, feature);

          if (observed) {
            if (
              output === undefined &&
              !(yield* stackOwnsAttachment(
                id,
                instanceId,
                news.product,
                observed.entitlement_feature,
              ))
            ) {
              return yield* Effect.fail(
                new ResourceNotOwnedError({
                  resourceType: "Stripe.ProductFeature",
                  resourceId: observed.id,
                  message: `Stripe product feature '${observed.id}' exists but its product or feature is not owned by this stack.`,
                }),
              );
            }
            return toAttributes(news.product, observed);
          }

          const createInput = {
            product: news.product,
            entitlement_feature: feature.id,
          };
          const created = yield* client.createProductFeature(createInput, {
            idempotencyKey: yield* createIdempotencyKey(
              "product-feature",
              id,
              createInput,
            ),
          });
          return toAttributes(news.product, created);
        }),
        read: Effect.fn(function* ({ id, instanceId, olds, output }) {
          if (output?.id) {
            return yield* client
              .getProductFeature(output.product, output.id)
              .pipe(
                Effect.map((row) => toAttributes(output.product, row)),
                Effect.catchIf(isStripeNotFound, () =>
                  Effect.succeed(undefined),
                ),
              );
          }

          const feature = yield* resolveFeature(olds.feature);
          const observed = yield* findAttachment(olds.product, feature);
          if (!observed) return undefined;
          const attrs = toAttributes(olds.product, observed);
          return (yield* stackOwnsAttachment(
            id,
            instanceId,
            olds.product,
            observed.entitlement_feature,
          ))
            ? attrs
            : Unowned(attrs);
        }),
        delete: Effect.fn(function* ({ output }) {
          yield* client
            .deleteProductFeature(output.product, output.id)
            .pipe(Effect.catchIf(isStripeNotFound, () => Effect.void));
        }),
      };
    }),
  );
