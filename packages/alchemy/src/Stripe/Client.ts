import type * as StripeClientModule from "@distilled.cloud/stripe/Client";
import * as StripeCredentials from "@distilled.cloud/stripe/Credentials";
import { UnknownStripeError } from "@distilled.cloud/stripe/Errors";
import type {
  API_ERRORS,
  ApiError,
  CardError,
  ExternalDependencyFailed,
  IdempotencyError,
  InvalidRequestError,
  NotFound,
  PaymentError,
  StripeParseError,
} from "@distilled.cloud/stripe/Errors";
import {
  DeleteProductsId,
  DeleteProductsProductFeaturesId,
  DeleteWebhookEndpointsWebhookEndpoint,
  GetEntitlementsFeatures,
  GetEntitlementsFeaturesId,
  GetPrices,
  GetPricesPrice,
  GetProducts,
  GetProductsId,
  GetProductsProductFeatures,
  GetProductsProductFeaturesId,
  GetWebhookEndpoints,
  GetWebhookEndpointsWebhookEndpoint,
  PostEntitlementsFeatures,
  PostEntitlementsFeaturesId,
  PostPrices,
  PostPricesPrice,
  PostProducts,
  PostProductsId,
  PostProductsProductFeatures,
  PostWebhookEndpoints,
  PostWebhookEndpointsWebhookEndpoint,
  type GetEntitlementsFeaturesInput,
  type GetEntitlementsFeaturesOutput,
  type GetPricesInput,
  type GetPricesOutput,
  type GetProductsInput,
  type GetProductsOutput,
  type GetProductsProductFeaturesInput,
  type GetProductsProductFeaturesOutput,
  type GetWebhookEndpointsInput,
  type GetWebhookEndpointsOutput,
  type PostEntitlementsFeaturesIdInput,
  type PostEntitlementsFeaturesInput,
  type PostEntitlementsFeaturesOutput,
  type PostPricesInput,
  type PostPricesOutput,
  type PostPricesPriceInput,
  type PostProductsIdInput,
  type PostProductsInput,
  type PostProductsOutput,
  type PostProductsProductFeaturesInput,
  type PostProductsProductFeaturesOutput,
  type PostWebhookEndpointsInput,
  type PostWebhookEndpointsOutput,
  type PostWebhookEndpointsWebhookEndpointInput,
} from "@distilled.cloud/stripe/Operations";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Predicate from "effect/Predicate";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";

export const DEFAULT_STRIPE_API_VERSION = "2026-03-25.dahlia";

export type StripeRequestOptions = {
  readonly idempotencyKey?: string;
  readonly apiVersion?: string;
};

type DistilledStripeRequestOptions = StripeClientModule.StripeRequestOptions;

export type StripeProduct = PostProductsOutput;
export type StripePrice = PostPricesOutput;
export type StripeFeature = PostEntitlementsFeaturesOutput;
export type StripeProductFeature = PostProductsProductFeaturesOutput;
export type StripeWebhookEndpoint = PostWebhookEndpointsOutput;
export type StripeClientError =
  | InstanceType<(typeof API_ERRORS)[number]>
  | ApiError
  | CardError
  | ExternalDependencyFailed
  | IdempotencyError
  | InvalidRequestError
  | NotFound
  | PaymentError
  | StripeParseError
  | UnknownStripeError;
export type UpdateProductInput = Omit<
  PostProductsIdInput,
  "images" | "marketing_features" | "shippable"
> & {
  readonly images?: readonly string[] | "";
  readonly marketing_features?: readonly { readonly name?: string }[] | "";
  readonly shippable?: boolean | "";
};
export type StripeCreatedRangeFilter = {
  readonly gt?: number;
  readonly gte?: number;
  readonly lt?: number;
  readonly lte?: number;
};
export type ListPricesInput = {
  readonly active?: GetPricesInput["active"];
  readonly created?: GetPricesInput["created"] | StripeCreatedRangeFilter;
  readonly currency?: GetPricesInput["currency"];
  readonly ending_before?: GetPricesInput["ending_before"];
  readonly product?: GetPricesInput["product"];
  readonly type?: GetPricesInput["type"];
  readonly lookupKeys?: readonly string[];
};

export interface StripeClientService {
  readonly createProduct: (
    input: PostProductsInput,
    options?: StripeRequestOptions,
  ) => Effect.Effect<StripeProduct, StripeClientError>;
  readonly updateProduct: (
    input: UpdateProductInput,
    options?: StripeRequestOptions,
  ) => Effect.Effect<StripeProduct, StripeClientError>;
  readonly getProduct: (
    id: string,
  ) => Effect.Effect<StripeProduct, StripeClientError>;
  readonly listProducts: (
    input?: Omit<GetProductsInput, "starting_after">,
  ) => Effect.Effect<readonly StripeProduct[], StripeClientError>;
  readonly deleteProduct: (
    id: string,
  ) => Effect.Effect<void, StripeClientError>;

  readonly createPrice: (
    input: PostPricesInput,
    options?: StripeRequestOptions,
  ) => Effect.Effect<StripePrice, StripeClientError>;
  readonly updatePrice: (
    input: PostPricesPriceInput,
    options?: StripeRequestOptions,
  ) => Effect.Effect<StripePrice, StripeClientError>;
  readonly getPrice: (
    id: string,
  ) => Effect.Effect<StripePrice, StripeClientError>;
  readonly listPrices: (
    input?: ListPricesInput,
  ) => Effect.Effect<readonly StripePrice[], StripeClientError>;

  readonly createFeature: (
    input: PostEntitlementsFeaturesInput,
    options?: StripeRequestOptions,
  ) => Effect.Effect<StripeFeature, StripeClientError>;
  readonly updateFeature: (
    input: PostEntitlementsFeaturesIdInput,
    options?: StripeRequestOptions,
  ) => Effect.Effect<StripeFeature, StripeClientError>;
  readonly getFeature: (
    id: string,
  ) => Effect.Effect<StripeFeature, StripeClientError>;
  readonly listFeatures: (
    input?: Omit<GetEntitlementsFeaturesInput, "starting_after">,
  ) => Effect.Effect<readonly StripeFeature[], StripeClientError>;

  readonly createProductFeature: (
    input: PostProductsProductFeaturesInput,
    options?: StripeRequestOptions,
  ) => Effect.Effect<StripeProductFeature, StripeClientError>;
  readonly getProductFeature: (
    product: string,
    id: string,
  ) => Effect.Effect<StripeProductFeature, StripeClientError>;
  readonly listProductFeatures: (
    product: string,
  ) => Effect.Effect<readonly StripeProductFeature[], StripeClientError>;
  readonly deleteProductFeature: (
    product: string,
    id: string,
  ) => Effect.Effect<void, StripeClientError>;

  readonly createWebhookEndpoint: (
    input: PostWebhookEndpointsInput,
    options?: StripeRequestOptions,
  ) => Effect.Effect<StripeWebhookEndpoint, StripeClientError>;
  readonly updateWebhookEndpoint: (
    input: PostWebhookEndpointsWebhookEndpointInput,
    options?: StripeRequestOptions,
  ) => Effect.Effect<StripeWebhookEndpoint, StripeClientError>;
  readonly getWebhookEndpoint: (
    id: string,
  ) => Effect.Effect<StripeWebhookEndpoint, StripeClientError>;
  readonly listWebhookEndpoints: (
    input?: Omit<GetWebhookEndpointsInput, "starting_after">,
  ) => Effect.Effect<readonly StripeWebhookEndpoint[], StripeClientError>;
  readonly deleteWebhookEndpoint: (
    id: string,
  ) => Effect.Effect<void, StripeClientError>;
}

export class StripeClient extends Context.Service<
  StripeClient,
  StripeClientService
>()("alchemy/StripeClient") {}

const toDistilledOptions = (
  options: StripeRequestOptions | undefined,
): DistilledStripeRequestOptions => ({
  apiVersion: options?.apiVersion ?? DEFAULT_STRIPE_API_VERSION,
  ...(Predicate.isUndefined(options?.idempotencyKey)
    ? {}
    : { idempotencyKey: options.idempotencyKey }),
});

const generatedStripeEffect = <A>(effect: unknown) =>
  effect as Effect.Effect<A, StripeClientError>;

const paginationCursor = (items: ReadonlyArray<{ readonly id: string }>) =>
  items.at(-1)?.id;

const collectPaginated = <TItem extends { readonly id: string }, TInput>(
  makeInput: (cursor: string | undefined) => TInput,
  getPage: (input: TInput, options: DistilledStripeRequestOptions) => unknown,
) =>
  Effect.gen(function* () {
    const items: TItem[] = [];
    let cursor: string | undefined;

    do {
      const page = yield* generatedStripeEffect<{
        readonly data: readonly TItem[];
        readonly has_more: boolean;
      }>(getPage(makeInput(cursor), toDistilledOptions(undefined)));
      items.push(...page.data);
      cursor = page.has_more ? paginationCursor(page.data) : undefined;
      if (page.has_more && cursor === undefined) {
        return yield* Effect.fail(
          new UnknownStripeError({
            body: {
              message: "Stripe pagination returned has_more without a cursor.",
            },
          }),
        );
      }
    } while (cursor !== undefined);

    return items;
  });

type StripeCredentialsConfig = StripeCredentials.Config;

const toGetPricesInput = (
  input: ListPricesInput | undefined,
): Omit<GetPricesInput, "starting_after"> => {
  const { lookupKeys, ...rest } = input ?? {};
  return {
    ...rest,
    ...(Predicate.isUndefined(lookupKeys) ? {} : { lookup_keys: lookupKeys }),
  } as Omit<GetPricesInput, "starting_after">;
};

export const makeStripeClient = (
  config: StripeCredentialsConfig,
): StripeClientService => {
  const distilledLayer = Layer.merge(
    Layer.succeed(StripeCredentials.Credentials, Effect.succeed(config)),
    FetchHttpClient.layer,
  );

  const run = <A, R>(effect: Effect.Effect<A, StripeClientError, R>) =>
    effect.pipe(Effect.provide(distilledLayer));

  return {
    createProduct: (input, options) =>
      run(
        generatedStripeEffect<StripeProduct>(
          PostProducts(input, toDistilledOptions(options)),
        ),
      ),
    updateProduct: (input, options) =>
      run(
        generatedStripeEffect<StripeProduct>(
          PostProductsId(input, toDistilledOptions(options)),
        ),
      ),
    getProduct: (id) =>
      run(
        generatedStripeEffect<StripeProduct>(
          GetProductsId({ id }, toDistilledOptions(undefined)),
        ),
      ),
    listProducts: (input) =>
      run(
        collectPaginated<StripeProduct, GetProductsInput>(
          (cursor) =>
            ({
              ...(input ?? {}),
              limit: 100,
              ...(cursor === undefined ? {} : { starting_after: cursor }),
            }) satisfies GetProductsInput,
          GetProducts,
        ),
      ),
    deleteProduct: (id) =>
      run(
        generatedStripeEffect(
          DeleteProductsId({ id }, toDistilledOptions(undefined)),
        ),
      ).pipe(Effect.asVoid),

    createPrice: (input, options) =>
      run(
        generatedStripeEffect<StripePrice>(
          PostPrices(input, toDistilledOptions(options)),
        ),
      ),
    updatePrice: (input, options) =>
      run(
        generatedStripeEffect<StripePrice>(
          PostPricesPrice(input, toDistilledOptions(options)),
        ),
      ),
    getPrice: (id) =>
      run(
        generatedStripeEffect<StripePrice>(
          GetPricesPrice({ price: id }, toDistilledOptions(undefined)),
        ),
      ),
    listPrices: (input) =>
      run(
        collectPaginated<StripePrice, GetPricesInput>(
          (cursor) =>
            ({
              ...toGetPricesInput(input),
              limit: 100,
              ...(cursor === undefined ? {} : { starting_after: cursor }),
            }) satisfies GetPricesInput,
          GetPrices,
        ),
      ),

    createFeature: (input, options) =>
      run(
        generatedStripeEffect<StripeFeature>(
          PostEntitlementsFeatures(input, toDistilledOptions(options)),
        ),
      ),
    updateFeature: (input, options) =>
      run(
        generatedStripeEffect<StripeFeature>(
          PostEntitlementsFeaturesId(input, toDistilledOptions(options)),
        ),
      ),
    getFeature: (id) =>
      run(
        generatedStripeEffect<StripeFeature>(
          GetEntitlementsFeaturesId({ id }, toDistilledOptions(undefined)),
        ),
      ),
    listFeatures: (input) =>
      run(
        collectPaginated<StripeFeature, GetEntitlementsFeaturesInput>(
          (cursor) =>
            ({
              ...(input ?? {}),
              limit: 100,
              ...(cursor === undefined ? {} : { starting_after: cursor }),
            }) satisfies GetEntitlementsFeaturesInput,
          GetEntitlementsFeatures,
        ),
      ),

    createProductFeature: (input, options) =>
      run(
        generatedStripeEffect<StripeProductFeature>(
          PostProductsProductFeatures(input, toDistilledOptions(options)),
        ),
      ),
    getProductFeature: (product, id) =>
      run(
        generatedStripeEffect<StripeProductFeature>(
          GetProductsProductFeaturesId(
            { product, id },
            toDistilledOptions(undefined),
          ),
        ),
      ),
    listProductFeatures: (product) =>
      run(
        collectPaginated<StripeProductFeature, GetProductsProductFeaturesInput>(
          (cursor) =>
            ({
              product,
              limit: 100,
              ...(cursor === undefined ? {} : { starting_after: cursor }),
            }) satisfies GetProductsProductFeaturesInput,
          GetProductsProductFeatures,
        ),
      ),
    deleteProductFeature: (product, id) =>
      run(
        generatedStripeEffect(
          DeleteProductsProductFeaturesId(
            { product, id },
            toDistilledOptions(undefined),
          ),
        ),
      ).pipe(Effect.asVoid),

    createWebhookEndpoint: (input, options) =>
      run(
        generatedStripeEffect<StripeWebhookEndpoint>(
          PostWebhookEndpoints(input, toDistilledOptions(options)),
        ),
      ),
    updateWebhookEndpoint: (input, options) =>
      run(
        generatedStripeEffect<StripeWebhookEndpoint>(
          PostWebhookEndpointsWebhookEndpoint(
            input,
            toDistilledOptions(options),
          ),
        ),
      ),
    getWebhookEndpoint: (id) =>
      run(
        generatedStripeEffect<StripeWebhookEndpoint>(
          GetWebhookEndpointsWebhookEndpoint(
            { webhook_endpoint: id },
            toDistilledOptions(undefined),
          ),
        ),
      ),
    listWebhookEndpoints: (input) =>
      run(
        collectPaginated<StripeWebhookEndpoint, GetWebhookEndpointsInput>(
          (cursor) =>
            ({
              ...(input ?? {}),
              limit: 100,
              ...(cursor === undefined ? {} : { starting_after: cursor }),
            }) satisfies GetWebhookEndpointsInput,
          GetWebhookEndpoints,
        ),
      ),
    deleteWebhookEndpoint: (id) =>
      run(
        generatedStripeEffect(
          DeleteWebhookEndpointsWebhookEndpoint(
            { webhook_endpoint: id },
            toDistilledOptions(undefined),
          ),
        ),
      ).pipe(Effect.asVoid),
  };
};

export const StripeClientLive = Layer.effect(
  StripeClient,
  Effect.gen(function* () {
    const credentials = yield* yield* StripeCredentials.Credentials;
    return makeStripeClient(credentials);
  }),
);

export type {
  GetEntitlementsFeaturesOutput,
  GetPricesOutput,
  GetProductsOutput,
  GetProductsProductFeaturesOutput,
  GetWebhookEndpointsOutput,
};
