import { Unowned } from "../AdoptPolicy.ts";
import { deepEqual, isResolved } from "../Diff.ts";
import { createPhysicalName } from "../PhysicalName.ts";
import * as Provider from "../Provider.ts";
import { Resource } from "../Resource.ts";
import {
  StripeClient,
  type StripeClientService,
  type StripeProduct,
} from "./Client.ts";
import type { Providers } from "./Providers.ts";
import {
  currentOwnership,
  clearableArrayForUpdate,
  clearableBooleanForUpdate,
  clearableStringForUpdate,
  createIdempotencyKey,
  createMetadataFingerprint,
  defined,
  getMetadataFingerprint,
  isOwnedBy,
  isStripeInvalidRequest,
  isStripeNotFound,
  metadataForUpdate,
  type Ownership,
  stripOwnershipMetadata,
  stripeObjectId,
  type StripeMetadata,
  withOwnershipMetadata,
} from "./Util.ts";
import * as Effect from "effect/Effect";
import {
  ProductReplacementBlockedError,
  ResourceNotOwnedError,
} from "./Errors.ts";

export interface ProductProps {
  /**
   * Optional Stripe product id. If omitted, Alchemy generates a stable id from
   * the logical resource id, stack, and stage.
   */
  readonly id?: string;
  readonly name: string;
  readonly active?: boolean;
  readonly description?: string;
  readonly metadata?: StripeMetadata;
  readonly images?: readonly string[];
  readonly marketingFeatures?: readonly { readonly name: string }[];
  readonly defaultPrice?: string;
  readonly shippable?: boolean;
  readonly statementDescriptor?: string;
  readonly taxCode?: string;
  readonly type?: "good" | "service";
  readonly unitLabel?: string;
  readonly url?: string;
}

export interface ProductAttributes {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly description?: string;
  readonly metadata: StripeMetadata;
  readonly defaultPrice?: string;
  readonly images: readonly string[];
  readonly livemode: boolean;
  readonly marketingFeatures: readonly { readonly name?: string }[];
  readonly shippable?: boolean;
  readonly statementDescriptor?: string;
  readonly taxCode?: string;
  readonly type: "good" | "service";
  readonly unitLabel?: string;
  readonly url?: string;
  readonly created: number;
  readonly updated: number;
}

export type Product = Resource<
  "Stripe.Product",
  ProductProps,
  ProductAttributes,
  never,
  Providers
>;

/**
 * A Stripe Product — the stable catalog object that prices and entitlement
 * feature attachments hang from.
 *
 * Product creation does not create a Stripe account or organization; it
 * manages catalog objects inside the account represented by `STRIPE_SECRET_KEY`.
 * Product metadata is tagged with Alchemy ownership markers so lost local
 * state can be adopted safely without claiming dashboard-created products.
 *
 * Deleting a product in Stripe is only possible before prices exist. On
 * destroy, Alchemy first tries to delete the product and falls back to
 * deactivating it when Stripe rejects deletion for historical billing reasons.
 *
 * @resource
 * @see https://docs.stripe.com/api/products
 */
export const Product = Resource<Product>("Stripe.Product");

const createProductId = (id: string, physicalId: string | undefined) =>
  Effect.gen(function* () {
    return (
      physicalId ??
      (yield* createPhysicalName({ id, lowercase: true, maxLength: 128 }))
    );
  });

const toAttributes = (product: StripeProduct): ProductAttributes => ({
  id: product.id,
  name: product.name,
  active: product.active,
  description: defined(product.description),
  metadata: stripOwnershipMetadata(product.metadata),
  defaultPrice: stripeObjectId(product.default_price),
  images: product.images,
  livemode: product.livemode,
  marketingFeatures: product.marketing_features,
  shippable: defined(product.shippable),
  statementDescriptor: defined(product.statement_descriptor),
  taxCode: stripeObjectId(product.tax_code),
  type: product.type,
  unitLabel: defined(product.unit_label),
  url: defined(product.url),
  created: product.created,
  updated: product.updated,
});

const mutablePropsChanged = (
  olds: ProductProps | undefined,
  news: ProductProps,
) =>
  !deepEqual(
    {
      name: olds?.name,
      active: olds?.active,
      description: olds?.description,
      metadata: olds?.metadata,
      images: olds?.images,
      marketingFeatures: olds?.marketingFeatures,
      defaultPrice: olds?.defaultPrice,
      shippable: olds?.shippable,
      statementDescriptor: olds?.statementDescriptor,
      taxCode: olds?.taxCode,
      unitLabel: olds?.unitLabel,
      url: olds?.url,
    },
    {
      name: news.name,
      active: news.active,
      description: news.description,
      metadata: news.metadata,
      images: news.images,
      marketingFeatures: news.marketingFeatures,
      defaultPrice: news.defaultPrice,
      shippable: news.shippable,
      statementDescriptor: news.statementDescriptor,
      taxCode: news.taxCode,
      unitLabel: news.unitLabel,
      url: news.url,
    },
  );

const immutableShape = (props: ProductProps | undefined) => ({
  type: props === undefined ? undefined : (props.type ?? "service"),
});

const observedImmutableShape = (product: StripeProduct) => ({
  type: product.type,
});

const isExpectedProductGeneration = (
  product: StripeProduct,
  props: ProductProps,
  fingerprint: string,
) => {
  const observedFingerprint = getMetadataFingerprint(product.metadata);
  return observedFingerprint === undefined
    ? deepEqual(observedImmutableShape(product), immutableShape(props))
    : observedFingerprint === fingerprint;
};

const isProductDeletionBlockedByPrices = (
  error: unknown,
): error is { readonly message?: string } => {
  if (!isStripeInvalidRequest(error)) return false;
  const message = (error as { readonly message?: unknown }).message;
  return (
    typeof message === "string" &&
    /cannot be deleted|has prices|user-created prices/i.test(message)
  );
};

const findOwnedProduct = (
  client: Pick<StripeClientService, "listProducts">,
  ownership: Ownership,
  props: ProductProps,
  fingerprint: string,
) =>
  client
    .listProducts()
    .pipe(
      Effect.map((products) =>
        products.find(
          (product) =>
            isOwnedBy(product.metadata, ownership) &&
            isExpectedProductGeneration(product, props, fingerprint),
        ),
      ),
    );

export const ProductProvider = () =>
  Provider.effect(
    Product,
    Effect.gen(function* () {
      const client = yield* StripeClient;

      const updateProduct = (
        productId: string,
        props: ProductProps,
        current: StripeProduct,
        metadata: StripeMetadata,
      ) =>
        client.updateProduct({
          id: productId,
          name: props.name,
          active: props.active ?? true,
          description: clearableStringForUpdate(
            defined(current.description),
            props.description,
          ),
          metadata: metadataForUpdate(current.metadata, metadata),
          images: clearableArrayForUpdate(current.images, props.images),
          marketing_features: clearableArrayForUpdate(
            current.marketing_features,
            props.marketingFeatures,
          ),
          default_price: clearableStringForUpdate(
            stripeObjectId(current.default_price),
            props.defaultPrice,
          ),
          shippable: clearableBooleanForUpdate(
            defined(current.shippable),
            props.shippable,
          ),
          statement_descriptor: clearableStringForUpdate(
            defined(current.statement_descriptor),
            props.statementDescriptor,
          ),
          tax_code: clearableStringForUpdate(
            stripeObjectId(current.tax_code),
            props.taxCode,
          ),
          unit_label: clearableStringForUpdate(
            defined(current.unit_label),
            props.unitLabel,
          ),
          url: clearableStringForUpdate(defined(current.url), props.url),
        });

      return {
        stables: ["id", "livemode"],
        list: Effect.fn(function* () {
          const products = yield* client.listProducts();
          return products
            .filter((product) => product.metadata.alchemy_stack !== undefined)
            .map(toAttributes);
        }),
        diff: Effect.fn(function* ({ id, olds, news, output }) {
          if (!isResolved(news)) return undefined;
          if (news.id !== undefined) {
            const oldId = output?.id ?? (yield* createProductId(id, olds?.id));
            const newId = yield* createProductId(id, news.id);
            if (oldId !== newId) return { action: "replace" } as const;
          }
          if (!deepEqual(immutableShape(olds), immutableShape(news))) {
            return { action: "replace" } as const;
          }
          return mutablePropsChanged(olds, news)
            ? ({ action: "update" } as const)
            : undefined;
        }),
        reconcile: Effect.fn(function* ({ id, instanceId, news, output }) {
          const ownership = yield* currentOwnership(id, instanceId);
          const productId = yield* createProductId(id, news.id);
          const fingerprint = yield* createMetadataFingerprint(
            immutableShape(news),
          );
          const metadata = withOwnershipMetadata(news.metadata, ownership, {
            fingerprint,
          });
          const lookupProductId = output?.id ?? productId;
          const observedById = yield* client
            .getProduct(lookupProductId)
            .pipe(
              Effect.catchIf(isStripeNotFound, () => Effect.succeed(undefined)),
            );
          const observed =
            observedById ??
            (news.id === undefined
              ? yield* findOwnedProduct(client, ownership, news, fingerprint)
              : undefined);

          if (observed === undefined) {
            const createInput = {
              id: productId,
              name: news.name,
              active: news.active ?? true,
              description: news.description,
              metadata,
              images: news.images,
              marketing_features: news.marketingFeatures,
              shippable: news.shippable,
              statement_descriptor: news.statementDescriptor,
              tax_code: news.taxCode,
              type: news.type,
              unit_label: news.unitLabel,
              url: news.url,
            };
            const created = yield* client.createProduct(createInput, {
              idempotencyKey: yield* createIdempotencyKey(
                "product",
                id,
                createInput,
              ),
            });
            return toAttributes(
              news.defaultPrice
                ? yield* updateProduct(created.id, news, created, metadata)
                : created,
            );
          }

          if (
            output === undefined &&
            !isOwnedBy(observed.metadata, ownership)
          ) {
            return yield* Effect.fail(
              new ResourceNotOwnedError({
                resourceType: "Stripe.Product",
                resourceId: observed.id,
                message: `Stripe product '${observed.id}' exists but is not owned by this stack.`,
              }),
            );
          }

          if (!isExpectedProductGeneration(observed, news, fingerprint)) {
            return yield* Effect.fail(
              new ProductReplacementBlockedError({
                productId: observed.id,
                message: `Stripe product '${observed.id}' still exists with immutable fields that do not match the desired resource. Use a new product id or remove the old Stripe product before replacing it.`,
              }),
            );
          }

          return yield* updateProduct(
            observed.id,
            news,
            observed,
            metadata,
          ).pipe(Effect.map(toAttributes));
        }),
        read: Effect.fn(function* ({ id, instanceId, olds, output }) {
          const ownership = yield* currentOwnership(id, instanceId);
          const productId =
            output?.id ?? (yield* createProductId(id, olds?.id));
          const productById = yield* client
            .getProduct(productId)
            .pipe(
              Effect.catchIf(isStripeNotFound, () => Effect.succeed(undefined)),
            );
          const fingerprint = yield* createMetadataFingerprint(
            immutableShape(olds),
          );
          const product =
            productById ??
            (olds.id === undefined
              ? yield* findOwnedProduct(client, ownership, olds, fingerprint)
              : undefined);
          if (!product) return undefined;

          const attrs = toAttributes(product);
          return isOwnedBy(product.metadata, ownership)
            ? attrs
            : Unowned(attrs);
        }),
        delete: Effect.fn(function* ({ output }) {
          yield* client.deleteProduct(output.id).pipe(
            Effect.catchIf(isStripeNotFound, () => Effect.void),
            Effect.catchIf(isProductDeletionBlockedByPrices, () =>
              Effect.gen(function* () {
                const current = yield* client
                  .getProduct(output.id)
                  .pipe(
                    Effect.catchIf(isStripeNotFound, () =>
                      Effect.succeed(undefined),
                    ),
                  );
                if (current === undefined) return;
                yield* client
                  .updateProduct({
                    id: output.id,
                    active: false,
                    metadata: metadataForUpdate(
                      current.metadata,
                      output.metadata,
                    ),
                  })
                  .pipe(Effect.asVoid);
              }),
            ),
          );
        }),
      };
    }),
  );
