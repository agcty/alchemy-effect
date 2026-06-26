import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { InvalidRequestError, NotFound } from "@distilled.cloud/stripe/Errors";
import * as Namespace from "../../src/Namespace.js";
import * as Provider from "../../src/Provider.js";
import {
  StripeClient,
  makeStripeClient,
  type StripeClientService,
  type StripeFeature,
  type StripePrice,
  type StripeProduct,
  type StripeProductFeature,
  type StripeWebhookEndpoint,
} from "../../src/Stripe/Client.js";
import * as Stripe from "../../src/Stripe/index.js";
import * as Test from "../../src/Test/Vitest.js";

const notFound = (id: string) => new NotFound({ message: `Missing ${id}` });
const invalidRequest = (message: string) =>
  new InvalidRequestError({ message });

const timestamp = 1_787_059_200;

type CapturedStripeFetchCall = {
  readonly url: string;
  readonly method: string | undefined;
  readonly body: string;
  readonly idempotencyKey: string | null;
};

const bodyToString = (body: BodyInit | null | undefined) => {
  if (body instanceof URLSearchParams) return body.toString();
  if (typeof body === "string") return body;
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  if (body instanceof ArrayBuffer) return new TextDecoder().decode(body);
  return String(body ?? "");
};

const captureStripeFetchCall = async (
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
): Promise<CapturedStripeFetchCall> => {
  if (input instanceof Request) {
    return {
      url: input.url,
      method: input.method,
      body: await input.clone().text(),
      idempotencyKey: input.headers.get("Idempotency-Key"),
    };
  }

  return {
    url: input.toString(),
    method: init?.method,
    body: bodyToString(init?.body),
    idempotencyKey: new Headers(init?.headers).get("Idempotency-Key"),
  };
};

const fakeProduct = ({
  id,
  ...overrides
}: Pick<StripeProduct, "id"> & Partial<StripeProduct>): StripeProduct => ({
  active: true,
  created: timestamp,
  default_price: undefined,
  description: null,
  id,
  images: [],
  livemode: false,
  marketing_features: [],
  metadata: {},
  name: "Pro",
  object: "product",
  package_dimensions: null,
  shippable: null,
  statement_descriptor: null,
  tax_code: null,
  type: "service",
  unit_label: null,
  updated: timestamp,
  url: null,
  ...overrides,
});

const fakeFeature = ({
  id,
  lookup_key,
  ...overrides
}: Pick<StripeFeature, "id" | "lookup_key"> &
  Partial<StripeFeature>): StripeFeature => ({
  active: true,
  id,
  livemode: false,
  lookup_key,
  metadata: {},
  name: "Documents search",
  object: "entitlements.feature",
  ...overrides,
});

const stringMetadata = (metadata: unknown) =>
  (metadata ?? {}) as Record<string, string>;

const applyMetadataUpdate = (
  current: Record<string, string>,
  update: unknown,
): Record<string, string> => {
  const next = { ...current };
  for (const [key, value] of Object.entries(stringMetadata(update))) {
    if (value === "") {
      delete next[key];
    } else {
      next[key] = value;
    }
  }
  return next;
};

const stringOrNull = (value: unknown) =>
  typeof value === "string" && value.length > 0 ? value : null;

const booleanOrNull = (value: unknown) =>
  typeof value === "boolean" ? value : null;

const stringList = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const marketingFeatures = (
  value: unknown,
): StripeProduct["marketing_features"] =>
  Array.isArray(value)
    ? value.map((item) => {
        if (
          (typeof item !== "object" && typeof item !== "function") ||
          item === null ||
          typeof (item as { readonly name?: unknown }).name !== "string"
        ) {
          return {};
        }
        return { name: (item as { readonly name: string }).name };
      })
    : [];

const makeFakeStripe = () => {
  const products = new Map<string, StripeProduct>();
  const prices = new Map<string, StripePrice>();
  const features = new Map<string, StripeFeature>();
  const productFeatures = new Map<string, Map<string, StripeProductFeature>>();
  const webhookEndpoints = new Map<string, StripeWebhookEndpoint>();
  let priceCounter = 0;
  let featureCounter = 0;
  let productFeatureCounter = 0;
  let webhookCounter = 0;
  const createIdempotencyKeys: string[] = [];

  const reset = () => {
    products.clear();
    prices.clear();
    features.clear();
    productFeatures.clear();
    webhookEndpoints.clear();
    createIdempotencyKeys.length = 0;
    priceCounter = 0;
    featureCounter = 0;
    productFeatureCounter = 0;
    webhookCounter = 0;
  };

  const service: StripeClientService = {
    createProduct: (input, options) =>
      Effect.sync(() => {
        if (options?.idempotencyKey)
          createIdempotencyKeys.push(options.idempotencyKey);
        const id = input.id ?? `prod_${products.size + 1}`;
        const product: StripeProduct = {
          active: input.active ?? true,
          created: timestamp,
          default_price: undefined,
          description: input.description ?? null,
          id,
          images: input.images ?? [],
          livemode: false,
          marketing_features: input.marketing_features ?? [],
          metadata: input.metadata ?? {},
          name: input.name,
          object: "product",
          package_dimensions: null,
          shippable: input.shippable ?? null,
          statement_descriptor: input.statement_descriptor ?? null,
          tax_code: input.tax_code ?? null,
          type: input.type ?? "service",
          unit_label: input.unit_label ?? null,
          updated: timestamp,
          url: input.url ?? null,
        };
        products.set(id, product);
        return product;
      }),
    updateProduct: (input) =>
      Effect.gen(function* () {
        const product = products.get(input.id);
        if (!product) return yield* Effect.fail(notFound(input.id));
        const next: StripeProduct = {
          ...product,
          ...(input.active === undefined ? {} : { active: input.active }),
          ...(input.default_price === undefined
            ? {}
            : { default_price: input.default_price }),
          ...(input.description === undefined
            ? {}
            : { description: stringOrNull(input.description) }),
          ...(input.images === undefined
            ? {}
            : { images: stringList(input.images) }),
          ...(input.marketing_features === undefined
            ? {}
            : {
                marketing_features: marketingFeatures(input.marketing_features),
              }),
          ...(input.metadata === undefined
            ? {}
            : {
                metadata: applyMetadataUpdate(product.metadata, input.metadata),
              }),
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.shippable === undefined
            ? {}
            : { shippable: booleanOrNull(input.shippable) }),
          ...(input.statement_descriptor === undefined
            ? {}
            : {
                statement_descriptor: stringOrNull(input.statement_descriptor),
              }),
          ...(input.tax_code === undefined ? {} : { tax_code: input.tax_code }),
          ...(input.unit_label === undefined
            ? {}
            : { unit_label: stringOrNull(input.unit_label) }),
          ...(input.url === undefined ? {} : { url: stringOrNull(input.url) }),
          updated: product.updated + 1,
        };
        products.set(input.id, next);
        return next;
      }),
    getProduct: (id) =>
      Effect.gen(function* () {
        const product = products.get(id);
        return product ?? (yield* Effect.fail(notFound(id)));
      }),
    listProducts: () => Effect.succeed([...products.values()]),
    deleteProduct: (id) =>
      Effect.gen(function* () {
        if (!products.has(id)) return yield* Effect.fail(notFound(id));
        if ([...prices.values()].some((price) => price.product === id)) {
          return yield* Effect.fail(invalidRequest("Product has prices."));
        }
        products.delete(id);
      }),

    createPrice: (input, options) =>
      Effect.sync(() => {
        if (options?.idempotencyKey)
          createIdempotencyKeys.push(options.idempotencyKey);
        if (input.lookup_key && input.transfer_lookup_key) {
          for (const [priceId, price] of prices) {
            if (price.lookup_key === input.lookup_key) {
              prices.set(priceId, { ...price, lookup_key: null });
            }
          }
        }
        const id = `price_${++priceCounter}`;
        const price: StripePrice = {
          active: input.active ?? true,
          billing_scheme: input.billing_scheme ?? "per_unit",
          created: timestamp,
          currency: input.currency,
          currency_options: undefined,
          custom_unit_amount: input.custom_unit_amount ?? null,
          id,
          livemode: false,
          lookup_key: input.lookup_key ?? null,
          metadata: stringMetadata(input.metadata),
          nickname: input.nickname ?? null,
          object: "price",
          product: input.product,
          recurring: input.recurring ?? null,
          tax_behavior: input.tax_behavior ?? null,
          tiers: undefined,
          tiers_mode: input.tiers_mode ?? null,
          transform_quantity: input.transform_quantity ?? null,
          type: input.recurring ? "recurring" : "one_time",
          unit_amount: input.unit_amount ?? null,
          unit_amount_decimal: input.unit_amount_decimal ?? null,
        };
        prices.set(id, price);
        return price;
      }),
    updatePrice: (input) =>
      Effect.gen(function* () {
        const price = prices.get(input.price);
        if (!price) return yield* Effect.fail(notFound(input.price));
        const next: StripePrice = {
          ...price,
          ...(input.active === undefined ? {} : { active: input.active }),
          ...(input.lookup_key === undefined
            ? {}
            : { lookup_key: input.lookup_key }),
          ...(input.metadata === undefined
            ? {}
            : {
                metadata: applyMetadataUpdate(price.metadata, input.metadata),
              }),
          ...(input.nickname === undefined
            ? {}
            : { nickname: stringOrNull(input.nickname) }),
          ...(input.tax_behavior === undefined
            ? {}
            : { tax_behavior: input.tax_behavior }),
        };
        prices.set(input.price, next);
        return next;
      }),
    getPrice: (id) =>
      Effect.gen(function* () {
        const price = prices.get(id);
        return price ?? (yield* Effect.fail(notFound(id)));
      }),
    listPrices: (input) =>
      Effect.succeed(
        [...prices.values()].filter((price) => {
          if (
            input?.lookupKeys &&
            !input.lookupKeys.includes(price.lookup_key ?? "")
          )
            return false;
          if (input?.active !== undefined && price.active !== input.active)
            return false;
          return true;
        }),
      ),

    createFeature: (input, options) =>
      Effect.sync(() => {
        if (options?.idempotencyKey)
          createIdempotencyKeys.push(options.idempotencyKey);
        const id = `feat_${++featureCounter}`;
        const feature: StripeFeature = {
          active: true,
          id,
          livemode: false,
          lookup_key: input.lookup_key,
          metadata: stringMetadata(input.metadata),
          name: input.name,
          object: "entitlements.feature",
        };
        features.set(id, feature);
        return feature;
      }),
    updateFeature: (input) =>
      Effect.gen(function* () {
        const feature = features.get(input.id);
        if (!feature) return yield* Effect.fail(notFound(input.id));
        const next: StripeFeature = {
          ...feature,
          ...(input.active === undefined ? {} : { active: input.active }),
          ...(input.metadata === undefined
            ? {}
            : {
                metadata: applyMetadataUpdate(feature.metadata, input.metadata),
              }),
          ...(input.name === undefined ? {} : { name: input.name }),
        };
        features.set(input.id, next);
        return next;
      }),
    getFeature: (id) =>
      Effect.gen(function* () {
        if (!id.startsWith("feat_"))
          return yield* Effect.fail(invalidRequest("Invalid id"));
        const feature = features.get(id);
        return feature ?? (yield* Effect.fail(notFound(id)));
      }),
    listFeatures: (input) =>
      Effect.succeed(
        [...features.values()].filter((feature) =>
          input?.lookup_key ? feature.lookup_key === input.lookup_key : true,
        ),
      ),

    createProductFeature: (input, options) =>
      Effect.gen(function* () {
        if (options?.idempotencyKey)
          createIdempotencyKeys.push(options.idempotencyKey);
        const feature = features.get(input.entitlement_feature);
        if (!feature)
          return yield* Effect.fail(notFound(input.entitlement_feature));
        const id = `prodfeat_${++productFeatureCounter}`;
        const attachment: StripeProductFeature = {
          entitlement_feature: feature,
          id,
          livemode: false,
          object: "product_feature",
        };
        const byProduct =
          productFeatures.get(input.product) ??
          new Map<string, StripeProductFeature>();
        byProduct.set(id, attachment);
        productFeatures.set(input.product, byProduct);
        return attachment;
      }),
    getProductFeature: (product, id) =>
      Effect.gen(function* () {
        const attachment = productFeatures.get(product)?.get(id);
        return attachment ?? (yield* Effect.fail(notFound(id)));
      }),
    listProductFeatures: (product) =>
      Effect.succeed([...(productFeatures.get(product)?.values() ?? [])]),
    deleteProductFeature: (product, id) =>
      Effect.gen(function* () {
        const byProduct = productFeatures.get(product);
        if (!byProduct?.delete(id)) return yield* Effect.fail(notFound(id));
      }),

    createWebhookEndpoint: (input, options) =>
      Effect.sync(() => {
        if (options?.idempotencyKey)
          createIdempotencyKeys.push(options.idempotencyKey);
        const id = `we_${++webhookCounter}`;
        const endpoint: StripeWebhookEndpoint = {
          api_version: input.api_version ?? "2026-03-25.dahlia",
          application: null,
          created: timestamp,
          description: stringOrNull(input.description),
          enabled_events: input.enabled_events,
          id,
          livemode: false,
          metadata: stringMetadata(input.metadata),
          object: "webhook_endpoint",
          secret: `whsec_${webhookCounter}`,
          status: "enabled",
          url: input.url,
        };
        webhookEndpoints.set(id, endpoint);
        return endpoint;
      }),
    updateWebhookEndpoint: (input) =>
      Effect.gen(function* () {
        const endpoint = webhookEndpoints.get(input.webhook_endpoint);
        if (!endpoint)
          return yield* Effect.fail(notFound(input.webhook_endpoint));
        const next: StripeWebhookEndpoint = {
          ...endpoint,
          ...(input.description === undefined
            ? {}
            : { description: stringOrNull(input.description) }),
          ...(input.disabled === undefined
            ? {}
            : { status: input.disabled ? "disabled" : "enabled" }),
          ...(input.enabled_events === undefined
            ? {}
            : { enabled_events: input.enabled_events }),
          ...(input.metadata === undefined
            ? {}
            : {
                metadata: applyMetadataUpdate(
                  endpoint.metadata,
                  input.metadata,
                ),
              }),
          ...(input.url === undefined ? {} : { url: input.url }),
          secret: undefined,
        };
        webhookEndpoints.set(input.webhook_endpoint, next);
        return next;
      }),
    getWebhookEndpoint: (id) =>
      Effect.gen(function* () {
        const endpoint = webhookEndpoints.get(id);
        return endpoint ?? (yield* Effect.fail(notFound(id)));
      }),
    listWebhookEndpoints: () => Effect.succeed([...webhookEndpoints.values()]),
    deleteWebhookEndpoint: (id) =>
      Effect.gen(function* () {
        if (!webhookEndpoints.delete(id))
          return yield* Effect.fail(notFound(id));
      }),
  };

  return {
    products,
    prices,
    features,
    productFeatures,
    webhookEndpoints,
    createIdempotencyKeys,
    reset,
    layer: Layer.succeed(StripeClient, service),
  };
};

const fake = makeFakeStripe();

const providers = Layer.effect(
  Stripe.Providers,
  Provider.collection([
    Stripe.Feature,
    Stripe.Price,
    Stripe.Product,
    Stripe.ProductFeature,
    Stripe.WebhookEndpoint,
  ]),
).pipe(
  Layer.provide(
    Layer.mergeAll(
      Stripe.FeatureProvider(),
      Stripe.PriceProvider(),
      Stripe.ProductProvider(),
      Stripe.ProductFeatureProvider(),
      Stripe.WebhookEndpointProvider(),
    ),
  ),
  Layer.provideMerge(fake.layer),
);

const { test } = Test.make({ providers });

test(
  "accepts Stripe boolean delete responses from the raw delete wrapper",
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const calls: CapturedStripeFetchCall[] = [];
      const fetch = async (
        input: Parameters<typeof globalThis.fetch>[0],
        init: Parameters<typeof globalThis.fetch>[1],
      ) => {
        calls.push(await captureStripeFetchCall(input, init));
        return new Response(
          JSON.stringify({ deleted: true, id: "prod_1", object: "product" }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      };
      return { calls, fetch };
    }),
    ({ calls, fetch }) =>
      Effect.gen(function* () {
        const client = makeStripeClient({
          apiKey: Redacted.make("sk_test_local"),
          apiBaseUrl: "https://api.stripe.test",
        });
        yield* client
          .deleteProduct("prod_1")
          .pipe(Effect.provideService(FetchHttpClient.Fetch, fetch));

        expect(calls).toMatchObject([
          {
            url: "https://api.stripe.test/v1/products/prod_1",
            method: "DELETE",
          },
        ]);
      }),
    () => Effect.void,
  ),
);

test(
  "encodes Stripe product clears through the raw form update wrapper",
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const calls: CapturedStripeFetchCall[] = [];
      const fetch = async (
        input: Parameters<typeof globalThis.fetch>[0],
        init: Parameters<typeof globalThis.fetch>[1],
      ) => {
        calls.push(await captureStripeFetchCall(input, init));
        return new Response(
          JSON.stringify({
            active: true,
            created: timestamp,
            default_price: null,
            description: null,
            id: "prod_1",
            images: [],
            livemode: false,
            marketing_features: [],
            metadata: {},
            name: "Pro",
            object: "product",
            package_dimensions: null,
            shippable: null,
            statement_descriptor: null,
            tax_code: null,
            type: "service",
            unit_label: null,
            updated: timestamp,
            url: null,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      };
      return { calls, fetch };
    }),
    ({ calls, fetch }) =>
      Effect.gen(function* () {
        const client = makeStripeClient({
          apiKey: Redacted.make("sk_test_local"),
          apiBaseUrl: "https://api.stripe.test",
        });
        yield* client
          .updateProduct(
            {
              id: "prod_1",
              name: "Pro",
              description: "",
              images: "",
              marketing_features: "",
              metadata: { legacy: "" },
              shippable: "",
            },
            { idempotencyKey: "alchemy:test" },
          )
          .pipe(Effect.provideService(FetchHttpClient.Fetch, fetch));

        const params = new URLSearchParams(calls[0]?.body);
        expect(calls[0]).toMatchObject({
          url: "https://api.stripe.test/v1/products/prod_1",
          method: "POST",
          idempotencyKey: "alchemy:test",
        });
        expect(params.get("description")).toBe("");
        expect(params.get("images")).toBe("");
        expect(params.get("marketing_features")).toBe("");
        expect(params.get("metadata[legacy]")).toBe("");
        expect(params.get("shippable")).toBe("");
      }),
    () => Effect.void,
  ),
);

test(
  "encodes nested Stripe price list filters through the raw lookup-key path",
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const calls: CapturedStripeFetchCall[] = [];
      const fetch = async (
        input: Parameters<typeof globalThis.fetch>[0],
        init: Parameters<typeof globalThis.fetch>[1],
      ) => {
        calls.push(await captureStripeFetchCall(input, init));
        return new Response(
          JSON.stringify({ data: [], has_more: false, object: "list" }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      };
      return { calls, fetch };
    }),
    ({ calls, fetch }) =>
      Effect.gen(function* () {
        const client = makeStripeClient({
          apiKey: Redacted.make("sk_test_local"),
          apiBaseUrl: "https://api.stripe.test",
        });
        yield* client
          .listPrices({
            active: true,
            created: { gte: 1_700_000_000, lte: 1_800_000_000 },
            lookupKeys: ["pro_monthly"],
          })
          .pipe(Effect.provideService(FetchHttpClient.Fetch, fetch));

        const request = new URL(calls[0]?.url ?? "");
        expect(calls[0]?.method).toBe("GET");
        expect(request.pathname).toBe("/v1/prices");
        expect(request.searchParams.get("active")).toBe("true");
        expect(request.searchParams.get("created[gte]")).toBe("1700000000");
        expect(request.searchParams.get("created[lte]")).toBe("1800000000");
        expect(request.searchParams.getAll("lookup_keys[]")).toEqual([
          "pro_monthly",
        ]);
      }),
    () => Effect.void,
  ),
);

test.provider(
  "manages products and prices with Stripe-safe destroy semantics",
  (stack) =>
    Effect.gen(function* () {
      fake.reset();

      yield* stack.deploy(
        Effect.gen(function* () {
          const product = yield* Stripe.Product("ProProduct", {
            id: "prod_pro",
            name: "Pro",
            active: false,
            description: "Legacy description",
            images: ["https://example.com/legacy.png"],
            marketingFeatures: [{ name: "Legacy feature" }],
            shippable: true,
            metadata: { plan: "pro", legacy: "remove-me" },
          });
          yield* Stripe.Price("ProMonthly", {
            product: product.id,
            lookupKey: "pro_monthly",
            currency: "eur",
            active: false,
            unitAmount: 1_900,
            recurring: { interval: "month" },
            metadata: { tier: "pro", legacy: "remove-me" },
          });
        }),
      );

      expect(fake.products.get("prod_pro")?.metadata).toMatchObject({
        plan: "pro",
        legacy: "remove-me",
        alchemy_id: "ProProduct",
      });
      const price = [...fake.prices.values()][0];
      expect(price?.lookup_key).toBe("pro_monthly");
      expect(price?.active).toBe(false);
      expect(price?.metadata).toMatchObject({
        tier: "pro",
        legacy: "remove-me",
        alchemy_id: "ProMonthly",
      });

      yield* stack.deploy(
        Effect.gen(function* () {
          const product = yield* Stripe.Product("ProProduct", {
            id: "prod_pro",
            name: "Pro Plus",
            type: "service",
            metadata: { plan: "pro" },
          });
          yield* Stripe.Price("ProMonthly", {
            product: product.id,
            lookupKey: "pro_monthly",
            currency: "eur",
            unitAmount: 1_900,
            recurring: { interval: "month" },
            nickname: "Pro monthly",
            metadata: { tier: "pro" },
          });
        }),
      );

      expect(fake.products.get("prod_pro")?.name).toBe("Pro Plus");
      expect(fake.products.get("prod_pro")?.active).toBe(true);
      expect(fake.products.get("prod_pro")?.description).toBeNull();
      expect(fake.products.get("prod_pro")?.images).toEqual([]);
      expect(fake.products.get("prod_pro")?.marketing_features).toEqual([]);
      expect(fake.products.get("prod_pro")?.shippable).toBeNull();
      expect(fake.products.get("prod_pro")?.metadata.legacy).toBeUndefined();
      expect([...fake.prices.values()][0]?.nickname).toBe("Pro monthly");
      expect([...fake.prices.values()][0]?.active).toBe(true);
      expect([...fake.prices.values()][0]?.metadata.legacy).toBeUndefined();

      yield* stack.deploy(
        Effect.gen(function* () {
          const product = yield* Stripe.Product("ProProduct", {
            id: "prod_pro",
            name: "Pro Plus",
            metadata: { plan: "pro" },
          });
          yield* Stripe.Price("ProMonthly", {
            product: product.id,
            lookupKey: "pro_monthly",
            currency: "eur",
            unitAmount: 2_900,
            recurring: { interval: "month" },
            nickname: "Pro monthly",
            metadata: { tier: "pro" },
          });
        }),
      );

      expect(new Set(fake.createIdempotencyKeys).size).toBe(
        fake.createIdempotencyKeys.length,
      );
      expect(fake.createIdempotencyKeys.every((key) => key.length <= 255)).toBe(
        true,
      );
      expect(
        fake.createIdempotencyKeys.some((key) => key.includes("ProMonthly")),
      ).toBe(false);
      const pricesAfterReplacement = [...fake.prices.values()];
      expect(pricesAfterReplacement).toHaveLength(2);
      expect(pricesAfterReplacement[0]?.active).toBe(false);
      expect(pricesAfterReplacement[0]?.lookup_key).toBeNull();
      expect(pricesAfterReplacement[0]?.unit_amount).toBe(1_900);
      expect(pricesAfterReplacement[1]?.active).toBe(true);
      expect(pricesAfterReplacement[1]?.lookup_key).toBe("pro_monthly");
      expect(pricesAfterReplacement[1]?.unit_amount).toBe(2_900);

      yield* stack.deploy(
        Effect.gen(function* () {
          const product = yield* Stripe.Product("ProProduct", {
            id: "prod_pro",
            name: "Pro Plus",
            metadata: { plan: "pro" },
          });
          yield* Stripe.Price("ProMonthly", {
            product: product.id,
            lookupKey: "pro_monthly",
            currency: "eur",
            unitAmount: 2_900,
            recurring: { interval: "month" },
            metadata: { tier: "pro" },
          });
        }),
      );

      expect([...fake.prices.values()].at(-1)?.nickname).toBeNull();

      yield* stack.destroy();

      expect(fake.products.get("prod_pro")?.active).toBe(false);
      expect(
        fake.products.get("prod_pro")?.metadata.alchemy_stack,
      ).toBeUndefined();
      expect([...fake.prices.values()].every((row) => !row.active)).toBe(true);
    }),
);

test.provider(
  "recovers generated products by ownership after local state loss",
  (stack) =>
    Effect.gen(function* () {
      fake.reset();
      fake.products.set(
        "prod_generated_previous",
        fakeProduct({
          id: "prod_generated_previous",
          metadata: {
            alchemy_stack: stack.name,
            alchemy_stage: "test",
            alchemy_id: "ProProduct",
          },
          name: "Previous generated product",
        }),
      );

      const recovered = yield* stack.deploy(
        Stripe.Product("ProProduct", {
          name: "Recovered generated product",
          metadata: { plan: "pro" },
        }),
      );

      expect(recovered.id).toBe("prod_generated_previous");
      expect(fake.products.size).toBe(1);
      expect(fake.products.get("prod_generated_previous")?.name).toBe(
        "Recovered generated product",
      );
      expect(fake.products.get("prod_generated_previous")?.metadata.plan).toBe(
        "pro",
      );
    }),
);

test.provider(
  "recovers from stale price generations after local state loss",
  (stack) =>
    Effect.gen(function* () {
      fake.reset();
      fake.prices.set("price_old", {
        active: true,
        billing_scheme: "per_unit",
        created: timestamp,
        currency: "eur",
        currency_options: undefined,
        custom_unit_amount: null,
        id: "price_old",
        livemode: false,
        lookup_key: "pro_monthly",
        metadata: {
          alchemy_stack: stack.name,
          alchemy_stage: "test",
          alchemy_id: "ProMonthly",
        },
        nickname: null,
        object: "price",
        product: "prod_pro",
        recurring: {
          interval: "month",
          interval_count: 1,
          usage_type: "licensed",
        },
        tax_behavior: null,
        tiers: undefined,
        tiers_mode: null,
        transform_quantity: null,
        type: "recurring",
        unit_amount: 1_900,
        unit_amount_decimal: null,
      });

      yield* stack.deploy(
        Stripe.Price("ProMonthly", {
          product: "prod_pro",
          lookupKey: "pro_monthly",
          currency: "eur",
          unitAmount: 2_900,
          recurring: { interval: "month" },
        }),
      );

      const prices = [...fake.prices.values()];
      expect(prices).toHaveLength(2);
      expect(fake.prices.get("price_old")?.active).toBe(false);
      expect(fake.prices.get("price_old")?.lookup_key).toBeNull();
      expect(prices.at(-1)?.active).toBe(true);
      expect(prices.at(-1)?.lookup_key).toBe("pro_monthly");
      expect(prices.at(-1)?.unit_amount).toBe(2_900);
    }),
);

test.provider(
  "creates an entitlements feature and attaches it to a product",
  (stack) =>
    Effect.gen(function* () {
      fake.reset();

      yield* stack.deploy(
        Effect.gen(function* () {
          yield* Stripe.Product("ProProduct", {
            id: "prod_pro",
            name: "Pro",
          });
          const feature = yield* Stripe.Feature("DocumentsSearch", {
            lookupKey: "documents.search",
            name: "Documents search",
            metadata: { legacy: "remove-me" },
          });
          yield* Stripe.ProductFeature("ProDocumentsSearch", {
            product: "prod_pro",
            feature: feature.lookupKey,
          });
        }),
      );

      const attachment = [
        ...(fake.productFeatures.get("prod_pro")?.values() ?? []),
      ][0];
      expect(attachment?.entitlement_feature.lookup_key).toBe(
        "documents.search",
      );

      yield* stack.deploy(
        Effect.gen(function* () {
          yield* Stripe.Product("ProProduct", {
            id: "prod_pro",
            name: "Pro",
          });
          const feature = yield* Stripe.Feature("DocumentsSearch", {
            lookupKey: "documents.search",
            name: "Documents search",
          });
          yield* Stripe.ProductFeature("ProDocumentsSearch", {
            product: "prod_pro",
            feature: feature.lookupKey,
          });
        }),
      );

      expect([...fake.features.values()][0]?.active).toBe(true);
      expect([...fake.features.values()][0]?.metadata.legacy).toBeUndefined();

      yield* stack.destroy();

      expect(fake.productFeatures.get("prod_pro")?.size ?? 0).toBe(0);
      expect([...fake.features.values()][0]?.active).toBe(true);
    }),
);

test.provider(
  "keeps sibling namespace webhooks when replacing a stale generation",
  (stack) =>
    Effect.gen(function* () {
      fake.reset();
      fake.webhookEndpoints.set("we_old_a", {
        api_version: "2025-09-30.clover",
        application: null,
        created: timestamp,
        description: null,
        enabled_events: ["customer.subscription.updated"],
        id: "we_old_a",
        livemode: false,
        metadata: {
          alchemy_stack: stack.name,
          alchemy_stage: "test",
          alchemy_id: "NamespaceA/BillingWebhook",
        },
        object: "webhook_endpoint",
        secret: undefined,
        status: "enabled",
        url: "https://example.com/old-stripe",
      });
      fake.webhookEndpoints.set("we_sibling_b", {
        api_version: "2025-09-30.clover",
        application: null,
        created: timestamp,
        description: null,
        enabled_events: ["customer.subscription.updated"],
        id: "we_sibling_b",
        livemode: false,
        metadata: {
          alchemy_stack: stack.name,
          alchemy_stage: "test",
          alchemy_id: "NamespaceB/BillingWebhook",
        },
        object: "webhook_endpoint",
        secret: undefined,
        status: "enabled",
        url: "https://example.com/sibling-stripe",
      });

      const endpoint = yield* stack.deploy(
        Namespace.push(
          "NamespaceA",
          Stripe.WebhookEndpoint("BillingWebhook", {
            url: "https://example.com/webhooks/stripe",
            enabledEvents: ["customer.subscription.updated"],
          }),
        ),
      );

      expect(fake.webhookEndpoints.has("we_old_a")).toBe(false);
      expect(fake.webhookEndpoints.has("we_sibling_b")).toBe(true);
      expect(endpoint.id).toBe("we_1");
      expect(fake.webhookEndpoints.get(endpoint.id)?.metadata.alchemy_id).toBe(
        "NamespaceA/BillingWebhook",
      );
    }),
);

test.provider(
  "requires adoption for existing product-feature attachments",
  (stack) =>
    Effect.gen(function* () {
      fake.reset();
      const feature = fakeFeature({
        id: "feat_existing",
        lookup_key: "documents.search",
      });
      fake.features.set(feature.id, feature);
      fake.productFeatures.set(
        "prod_pro",
        new Map([
          [
            "prodfeat_existing",
            {
              entitlement_feature: feature,
              id: "prodfeat_existing",
              livemode: false,
              object: "product_feature",
            },
          ],
        ]),
      );

      const error = yield* stack
        .deploy(
          Stripe.ProductFeature("ProDocumentsSearch", {
            product: "prod_pro",
            feature: "documents.search",
          }),
        )
        .pipe(Effect.flip);

      expect((error as { readonly _tag?: string })._tag).toBe(
        "OwnedBySomeoneElse",
      );
      expect(fake.productFeatures.get("prod_pro")?.size).toBe(1);
    }),
);

test.provider(
  "recovers owned product-feature attachments after local state loss",
  (stack) =>
    Effect.gen(function* () {
      fake.reset();
      fake.products.set(
        "prod_pro",
        fakeProduct({
          id: "prod_pro",
          metadata: {
            alchemy_stack: stack.name,
            alchemy_stage: "test",
            alchemy_id: "ProProduct",
          },
        }),
      );
      const feature = fakeFeature({
        id: "feat_existing",
        lookup_key: "documents.search",
        metadata: {
          alchemy_stack: stack.name,
          alchemy_stage: "test",
          alchemy_id: "DocumentsSearch",
        },
      });
      fake.features.set(feature.id, feature);
      fake.productFeatures.set(
        "prod_pro",
        new Map([
          [
            "prodfeat_existing",
            {
              entitlement_feature: feature,
              id: "prodfeat_existing",
              livemode: false,
              object: "product_feature",
            },
          ],
        ]),
      );

      const adopted = yield* stack.deploy(
        Stripe.ProductFeature("ProDocumentsSearch", {
          product: "prod_pro",
          feature: "documents.search",
        }),
      );

      expect(adopted.id).toBe("prodfeat_existing");
      expect(fake.productFeatures.get("prod_pro")?.size).toBe(1);
    }),
);

test.provider(
  "lists product-feature attachments under Alchemy-owned products",
  (_stack) =>
    Effect.gen(function* () {
      fake.reset();
      const ownedFeature = fakeFeature({
        id: "feat_owned",
        lookup_key: "documents.search",
      });
      const foreignFeature = fakeFeature({
        id: "feat_foreign",
        lookup_key: "foreign.search",
      });
      fake.features.set(ownedFeature.id, ownedFeature);
      fake.features.set(foreignFeature.id, foreignFeature);
      fake.products.set(
        "prod_owned",
        fakeProduct({
          id: "prod_owned",
          metadata: {
            alchemy_stack: "other-stack",
            alchemy_stage: "test",
            alchemy_id: "Product",
          },
        }),
      );
      fake.products.set(
        "prod_foreign",
        fakeProduct({ id: "prod_foreign", metadata: {} }),
      );
      fake.productFeatures.set(
        "prod_owned",
        new Map([
          [
            "prodfeat_owned",
            {
              entitlement_feature: ownedFeature,
              id: "prodfeat_owned",
              livemode: false,
              object: "product_feature",
            },
          ],
        ]),
      );
      fake.productFeatures.set(
        "prod_foreign",
        new Map([
          [
            "prodfeat_foreign",
            {
              entitlement_feature: foreignFeature,
              id: "prodfeat_foreign",
              livemode: false,
              object: "product_feature",
            },
          ],
        ]),
      );

      const provider = yield* Provider.findProvider(Stripe.ProductFeature);
      const listed = yield* provider.list();

      expect(listed.map((row) => row.id)).toEqual(["prodfeat_owned"]);
      expect(listed[0]?.product).toBe("prod_owned");
    }),
);

test.provider("rejects inactive features before product attachment", (stack) =>
  Effect.gen(function* () {
    fake.reset();
    fake.features.set(
      "feat_inactive",
      fakeFeature({
        active: false,
        id: "feat_inactive",
        lookup_key: "documents.search",
      }),
    );

    const error = yield* stack
      .deploy(
        Stripe.ProductFeature("ProDocumentsSearch", {
          product: "prod_pro",
          feature: "documents.search",
        }),
      )
      .pipe(Effect.flip);

    expect((error as { readonly _tag?: string })._tag).toBe(
      "InactiveFeatureAttachmentError",
    );
    expect(fake.productFeatures.get("prod_pro")?.size ?? 0).toBe(0);
  }),
);

test.provider("preserves webhook signing secrets after update", (stack) =>
  Effect.gen(function* () {
    fake.reset();

    const created = yield* stack.deploy(
      Stripe.WebhookEndpoint("BillingWebhook", {
        url: "https://example.com/webhooks/stripe",
        enabledEvents: [
          "customer.subscription.updated",
          "entitlements.active_entitlement_summary.updated",
        ],
        disabled: true,
        metadata: { purpose: "billing", legacy: "remove-me" },
      }),
    );

    expect(created.secret ? Redacted.value(created.secret) : undefined).toBe(
      "whsec_1",
    );
    expect(fake.webhookEndpoints.get(created.id)?.status).toBe("disabled");

    const updated = yield* stack.deploy(
      Stripe.WebhookEndpoint("BillingWebhook", {
        url: "https://example.com/webhooks/stripe",
        enabledEvents: [
          "customer.subscription.updated",
          "entitlements.active_entitlement_summary.updated",
        ],
        apiVersion: "2026-03-25.dahlia",
        connect: false,
        description: "Billing sync webhook",
        metadata: { purpose: "billing" },
      }),
    );

    expect(updated.description).toBe("Billing sync webhook");
    expect(updated.disabled).toBe(false);
    expect(updated.secret ? Redacted.value(updated.secret) : undefined).toBe(
      "whsec_1",
    );
    expect(
      fake.webhookEndpoints.get(updated.id)?.metadata.legacy,
    ).toBeUndefined();

    const cleared = yield* stack.deploy(
      Stripe.WebhookEndpoint("BillingWebhook", {
        url: "https://example.com/webhooks/stripe",
        enabledEvents: [
          "customer.subscription.updated",
          "entitlements.active_entitlement_summary.updated",
        ],
        metadata: { purpose: "billing" },
      }),
    );

    expect(cleared.description).toBeUndefined();
    expect(cleared.secret ? Redacted.value(cleared.secret) : undefined).toBe(
      "whsec_1",
    );
    expect(fake.webhookEndpoints.get(updated.id)?.description).toBeNull();

    yield* stack.destroy();
    expect(fake.webhookEndpoints.size).toBe(0);
  }),
);

test.provider(
  "replaces stale webhook generations after local state loss",
  (stack) =>
    Effect.gen(function* () {
      fake.reset();
      fake.webhookEndpoints.set("we_old", {
        api_version: "2025-09-30.clover",
        application: null,
        created: timestamp,
        description: null,
        enabled_events: ["customer.subscription.updated"],
        id: "we_old",
        livemode: false,
        metadata: {
          alchemy_stack: stack.name,
          alchemy_stage: "test",
          alchemy_id: "BillingWebhook",
        },
        object: "webhook_endpoint",
        secret: undefined,
        status: "enabled",
        url: "https://example.com/old-stripe",
      });

      const endpoint = yield* stack.deploy(
        Stripe.WebhookEndpoint("BillingWebhook", {
          url: "https://example.com/webhooks/stripe",
          enabledEvents: ["customer.subscription.updated"],
        }),
      );

      expect(fake.webhookEndpoints.has("we_old")).toBe(false);
      expect(endpoint.id).toBe("we_1");
      expect(fake.webhookEndpoints.get(endpoint.id)?.url).toBe(
        "https://example.com/webhooks/stripe",
      );
    }),
);
