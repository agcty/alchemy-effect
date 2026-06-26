import { Unowned } from "../AdoptPolicy.ts";
import { deepEqual, isResolved } from "../Diff.ts";
import * as Provider from "../Provider.ts";
import { Resource } from "../Resource.ts";
import { StripeClient, type StripePrice } from "./Client.ts";
import type { Providers } from "./Providers.ts";
import {
  currentOwnership,
  clearableStringForUpdate,
  createIdempotencyKey,
  createMetadataFingerprint,
  defined,
  getMetadataFingerprint,
  isOwnedBy,
  isStripeNotFound,
  metadataForUpdate,
  stripOwnershipMetadata,
  stripeObjectId,
  type Ownership,
  type StripeMetadata,
  withOwnershipMetadata,
} from "./Util.ts";
import * as Effect from "effect/Effect";
import { ResourceNotOwnedError } from "./Errors.ts";

export interface PriceRecurring {
  readonly interval: "day" | "week" | "month" | "year";
  readonly intervalCount?: number;
  readonly meter?: string;
  readonly trialPeriodDays?: number;
  readonly usageType?: "licensed" | "metered";
}

export interface PriceTier {
  readonly flat_amount?: number;
  readonly flat_amount_decimal?: string;
  readonly unit_amount?: number;
  readonly unit_amount_decimal?: string;
  readonly up_to: unknown;
}

export interface PriceProps {
  readonly product: string;
  readonly lookupKey: string;
  readonly currency: string;
  readonly active?: boolean;
  readonly billingScheme?: "per_unit" | "tiered";
  readonly metadata?: StripeMetadata;
  readonly nickname?: string;
  readonly recurring?: PriceRecurring;
  readonly taxBehavior?: "exclusive" | "inclusive" | "unspecified";
  readonly tiers?: readonly PriceTier[];
  readonly tiersMode?: "graduated" | "volume";
  readonly transferLookupKey?: boolean;
  readonly transformQuantity?: {
    readonly divideBy: number;
    readonly round: "down" | "up";
  };
  readonly unitAmount?: number;
  readonly unitAmountDecimal?: string;
}

export interface PriceAttributes {
  readonly id: string;
  readonly product: string;
  readonly lookupKey: string;
  readonly active: boolean;
  readonly billingScheme: "per_unit" | "tiered";
  readonly currency: string;
  readonly livemode: boolean;
  readonly metadata: StripeMetadata;
  readonly nickname?: string;
  readonly recurring: unknown;
  readonly taxBehavior?: "exclusive" | "inclusive" | "unspecified";
  readonly tiers?: readonly unknown[];
  readonly tiersMode?: "graduated" | "volume";
  readonly transformQuantity: unknown;
  readonly type: "one_time" | "recurring";
  readonly unitAmount?: number;
  readonly unitAmountDecimal?: string;
  readonly created: number;
}

export type Price = Resource<
  "Stripe.Price",
  PriceProps,
  PriceAttributes,
  never,
  Providers
>;

/**
 * A Stripe Price — the immutable commercial terms for a product.
 *
 * Stripe prices are historical records. Currency, product, amount, recurring
 * interval, billing scheme, and tiering are treated as replacement fields.
 * Mutable fields such as `active`, `nickname`, `metadata`, and `lookupKey`
 * update in place.
 *
 * On destroy, Alchemy deactivates the price instead of deleting it because
 * Stripe does not expose a price delete API.
 *
 * @resource
 * @see https://docs.stripe.com/api/prices
 */
export const Price = Resource<Price>("Stripe.Price");

const toRecurringInput = (recurring: PriceRecurring | undefined) =>
  recurring === undefined
    ? undefined
    : {
        interval: recurring.interval,
        interval_count: recurring.intervalCount,
        meter: recurring.meter,
        trial_period_days: recurring.trialPeriodDays,
        usage_type: recurring.usageType,
      };

const toAttributes = (price: StripePrice): PriceAttributes => ({
  id: price.id,
  product: stripeObjectId(price.product) ?? "",
  lookupKey: price.lookup_key ?? "",
  active: price.active,
  billingScheme: price.billing_scheme,
  currency: price.currency,
  livemode: price.livemode,
  metadata: stripOwnershipMetadata(price.metadata),
  nickname: defined(price.nickname),
  recurring: price.recurring,
  taxBehavior: defined(price.tax_behavior),
  tiers: price.tiers,
  tiersMode: defined(price.tiers_mode),
  transformQuantity: price.transform_quantity,
  type: price.type,
  unitAmount: defined(price.unit_amount),
  unitAmountDecimal: defined(price.unit_amount_decimal),
  created: price.created,
});

const normalizedRecurringShape = (recurring: PriceRecurring | undefined) =>
  recurring === undefined
    ? undefined
    : {
        interval: recurring.interval,
        intervalCount: recurring.intervalCount ?? 1,
        meter: recurring.meter,
        trialPeriodDays: recurring.trialPeriodDays,
        usageType: recurring.usageType ?? "licensed",
      };

const recordValue = (value: unknown): Record<string, unknown> | undefined =>
  (typeof value === "object" || typeof value === "function") && value !== null
    ? (value as Record<string, unknown>)
    : undefined;

const stringValue = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const numberValue = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const observedRecurringShape = (recurring: unknown) => {
  const record = recordValue(recurring);
  const interval = stringValue(record?.interval);
  if (record === undefined || interval === undefined) return undefined;
  return {
    interval,
    intervalCount: numberValue(record.interval_count) ?? 1,
    meter: stringValue(record.meter),
    trialPeriodDays: numberValue(record.trial_period_days),
    usageType: stringValue(record.usage_type) ?? "licensed",
  };
};

const observedTransformQuantityShape = (transformQuantity: unknown) => {
  const record = recordValue(transformQuantity);
  const divideBy = numberValue(record?.divide_by);
  const round = stringValue(record?.round);
  if (record === undefined || divideBy === undefined || round === undefined)
    return undefined;
  return { divideBy, round };
};

const immutableShape = (props: PriceProps | undefined) => ({
  product: props?.product,
  currency: props?.currency,
  billingScheme:
    props === undefined ? undefined : (props.billingScheme ?? "per_unit"),
  recurring: normalizedRecurringShape(props?.recurring),
  taxBehavior: props?.taxBehavior,
  tiers: props?.tiers,
  tiersMode: props?.tiersMode,
  transformQuantity: props?.transformQuantity,
  unitAmount: props?.unitAmount,
  unitAmountDecimal: props?.unitAmountDecimal,
});

const observedImmutableShape = (price: StripePrice) => ({
  product: stripeObjectId(price.product) ?? "",
  currency: price.currency,
  billingScheme: price.billing_scheme,
  recurring: observedRecurringShape(price.recurring),
  taxBehavior: defined(price.tax_behavior),
  tiers: price.tiers,
  tiersMode: defined(price.tiers_mode),
  transformQuantity: observedTransformQuantityShape(price.transform_quantity),
  unitAmount: defined(price.unit_amount),
  unitAmountDecimal: defined(price.unit_amount_decimal),
});

const mutableShape = (props: PriceProps | undefined) => ({
  active: props?.active,
  lookupKey: props?.lookupKey,
  metadata: props?.metadata,
  nickname: props?.nickname,
});

const findByLookupKey = (lookupKey: string) =>
  Effect.gen(function* () {
    const client = yield* StripeClient;
    const activePrices = yield* client.listPrices({
      lookupKeys: [lookupKey],
      active: true,
    });
    const activePrice = activePrices.find(
      (price) => price.lookup_key === lookupKey,
    );
    if (activePrice) return activePrice;
    const inactivePrices = yield* client.listPrices({
      lookupKeys: [lookupKey],
      active: false,
    });
    return inactivePrices.find((price) => price.lookup_key === lookupKey);
  });

const isExpectedPriceGeneration = (
  price: StripePrice,
  props: PriceProps,
  fingerprint: string,
): boolean => {
  const observedFingerprint = getMetadataFingerprint(price.metadata);
  return observedFingerprint === undefined
    ? deepEqual(observedImmutableShape(price), immutableShape(props))
    : observedFingerprint === fingerprint;
};

export const PriceProvider = () =>
  Provider.effect(
    Price,
    Effect.gen(function* () {
      const client = yield* StripeClient;

      const updatePrice = (
        priceId: string,
        props: PriceProps,
        current: StripePrice,
        metadata: StripeMetadata,
      ) =>
        client.updatePrice({
          price: priceId,
          active: props.active ?? true,
          lookup_key: props.lookupKey,
          metadata: metadataForUpdate(current.metadata, metadata),
          nickname: clearableStringForUpdate(
            defined(current.nickname),
            props.nickname,
          ),
          tax_behavior: props.taxBehavior,
          transfer_lookup_key: props.transferLookupKey,
        });

      const deactivateStaleOwnedPrices = (
        ownership: Ownership,
        keepId: string,
      ) =>
        Effect.gen(function* () {
          const prices = yield* client.listPrices();
          yield* Effect.forEach(
            prices.filter(
              (price) =>
                price.id !== keepId &&
                price.active &&
                isOwnedBy(price.metadata, ownership),
            ),
            (price) =>
              client
                .updatePrice({ price: price.id, active: false })
                .pipe(
                  Effect.catchIf(isStripeNotFound, () =>
                    Effect.succeed(undefined),
                  ),
                ),
            { discard: true },
          );
        });

      return {
        stables: ["id", "currency", "product", "type", "livemode"],
        list: Effect.fn(function* () {
          const prices = yield* client.listPrices();
          return prices
            .filter(
              (price) =>
                price.metadata.alchemy_stack !== undefined && price.active,
            )
            .map(toAttributes);
        }),
        diff: Effect.fn(function* ({ olds, news }) {
          if (!isResolved(news)) return undefined;
          if (!deepEqual(immutableShape(olds), immutableShape(news))) {
            return { action: "replace" } as const;
          }
          return deepEqual(mutableShape(olds), mutableShape(news))
            ? undefined
            : ({ action: "update" } as const);
        }),
        reconcile: Effect.fn(function* ({ id, fqn, news, output }) {
          const ownership = yield* currentOwnership(id, fqn);
          const fingerprint = yield* createMetadataFingerprint(
            immutableShape(news),
          );
          const metadata = withOwnershipMetadata(news.metadata, ownership, {
            fingerprint,
          });
          const observed = output?.id
            ? yield* client
                .getPrice(output.id)
                .pipe(
                  Effect.catchIf(isStripeNotFound, () =>
                    Effect.succeed(undefined),
                  ),
                )
            : yield* findByLookupKey(news.lookupKey);

          if (observed === undefined) {
            const createInput = {
              product: news.product,
              lookup_key: news.lookupKey,
              currency: news.currency,
              active: news.active ?? true,
              billing_scheme: news.billingScheme,
              metadata,
              nickname: news.nickname,
              recurring: toRecurringInput(news.recurring),
              tax_behavior: news.taxBehavior,
              tiers: news.tiers,
              tiers_mode: news.tiersMode,
              transfer_lookup_key: news.transferLookupKey ?? true,
              transform_quantity: news.transformQuantity
                ? {
                    divide_by: news.transformQuantity.divideBy,
                    round: news.transformQuantity.round,
                  }
                : undefined,
              unit_amount: news.unitAmount,
              unit_amount_decimal: news.unitAmountDecimal,
            };
            const created = yield* client.createPrice(createInput, {
              idempotencyKey: yield* createIdempotencyKey(
                "price",
                id,
                createInput,
              ),
            });
            yield* deactivateStaleOwnedPrices(ownership, created.id);
            return toAttributes(created);
          }

          if (
            output === undefined &&
            !isOwnedBy(observed.metadata, ownership)
          ) {
            return yield* Effect.fail(
              new ResourceNotOwnedError({
                resourceType: "Stripe.Price",
                resourceId: observed.id,
                message: `Stripe price '${observed.id}' exists but is not owned by this stack.`,
              }),
            );
          }

          if (
            output === undefined &&
            !isExpectedPriceGeneration(observed, news, fingerprint)
          ) {
            const createInput = {
              product: news.product,
              lookup_key: news.lookupKey,
              currency: news.currency,
              active: news.active ?? true,
              billing_scheme: news.billingScheme,
              metadata,
              nickname: news.nickname,
              recurring: toRecurringInput(news.recurring),
              tax_behavior: news.taxBehavior,
              tiers: news.tiers,
              tiers_mode: news.tiersMode,
              transfer_lookup_key: news.transferLookupKey ?? true,
              transform_quantity: news.transformQuantity
                ? {
                    divide_by: news.transformQuantity.divideBy,
                    round: news.transformQuantity.round,
                  }
                : undefined,
              unit_amount: news.unitAmount,
              unit_amount_decimal: news.unitAmountDecimal,
            };
            const created = yield* client.createPrice(createInput, {
              idempotencyKey: yield* createIdempotencyKey(
                "price",
                id,
                createInput,
              ),
            });
            yield* deactivateStaleOwnedPrices(ownership, created.id);
            return toAttributes(created);
          }

          const updated = yield* updatePrice(
            observed.id,
            news,
            observed,
            metadata,
          );
          if (output === undefined) {
            yield* deactivateStaleOwnedPrices(ownership, updated.id);
          }
          return toAttributes(updated);
        }),
        read: Effect.fn(function* ({ id, fqn, olds, output }) {
          const fingerprint = yield* createMetadataFingerprint(
            immutableShape(olds),
          );
          const price = output?.id
            ? yield* client
                .getPrice(output.id)
                .pipe(
                  Effect.catchIf(isStripeNotFound, () =>
                    Effect.succeed(undefined),
                  ),
                )
            : yield* findByLookupKey(olds.lookupKey);
          if (!price) return undefined;

          const attrs = toAttributes(price);
          const ownership = yield* currentOwnership(id, fqn);
          if (!isOwnedBy(price.metadata, ownership)) return Unowned(attrs);
          if (
            output === undefined &&
            !isExpectedPriceGeneration(price, olds, fingerprint)
          ) {
            return undefined;
          }
          return attrs;
        }),
        delete: Effect.fn(function* ({ output }) {
          yield* client
            .updatePrice({
              price: output.id,
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
