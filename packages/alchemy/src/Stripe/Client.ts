import type * as StripeClientModule from "@distilled.cloud/stripe/Client";
import * as StripeCredentials from "@distilled.cloud/stripe/Credentials";
import {
  InvalidRequestError,
  NotFound,
  UnknownStripeError,
} from "@distilled.cloud/stripe/Errors";
import type {
  API_ERRORS,
  ApiError,
  CardError,
  ExternalDependencyFailed,
  IdempotencyError,
  PaymentError,
  StripeParseError,
} from "@distilled.cloud/stripe/Errors";
import {
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
import * as Redacted from "effect/Redacted";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import type * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import * as UrlParams from "effect/unstable/http/UrlParams";

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
  ...(options?.idempotencyKey === undefined
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

const stripeApiUrl = (config: StripeCredentialsConfig, path: string) =>
  `${config.apiBaseUrl.replace(/\/$/, "")}${path}`;

const stripeHeaders = (
  config: StripeCredentialsConfig,
  options?: StripeRequestOptions,
): Record<string, string> => ({
  Authorization: `Bearer ${Redacted.value(config.apiKey)}`,
  "Stripe-Version": options?.apiVersion ?? DEFAULT_STRIPE_API_VERSION,
  ...(options?.idempotencyKey === undefined
    ? {}
    : { "Idempotency-Key": options.idempotencyKey }),
});

const readJsonBody = (response: HttpClientResponse.HttpClientResponse) =>
  response.text.pipe(
    Effect.map((text) => {
      if (text.length === 0) return {};
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return { _nonJsonError: true, body: text };
      }
    }),
    Effect.mapError((error) => new UnknownStripeError({ body: error })),
  );

const stripeErrorDetails = (body: unknown) => {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { readonly error?: unknown }).error === "object" &&
    (body as { readonly error?: unknown }).error !== null
  ) {
    const error = (body as { readonly error: Record<string, unknown> }).error;
    return {
      type: typeof error.type === "string" ? error.type : undefined,
      code: typeof error.code === "string" ? error.code : undefined,
      message:
        typeof error.message === "string"
          ? error.message
          : "Stripe request failed.",
      param: typeof error.param === "string" ? error.param : undefined,
      doc_url: typeof error.doc_url === "string" ? error.doc_url : undefined,
      request_log_url:
        typeof error.request_log_url === "string"
          ? error.request_log_url
          : undefined,
    };
  }
  return { message: "Stripe request failed." };
};

const failStripeResponse = (status: number, body: unknown) => {
  const error = stripeErrorDetails(body);
  if (error.type === "invalid_request_error" || status === 400) {
    return Effect.fail(new InvalidRequestError(error));
  }
  if (status === 404) {
    return Effect.fail(new NotFound({ message: error.message }));
  }
  return Effect.fail(new UnknownStripeError({ body }));
};

const executeStripeRequest = (request: HttpClientRequest.HttpClientRequest) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    return yield* client.execute(request).pipe(
      Effect.scoped,
      Effect.mapError((error) => new UnknownStripeError({ body: error })),
    );
  });

const stripeRequestJson = <A>(
  config: StripeCredentialsConfig,
  path: string,
): Effect.Effect<A, StripeClientError, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const response = yield* executeStripeRequest(
      HttpClientRequest.get(stripeApiUrl(config, path)).pipe(
        HttpClientRequest.setHeaders(stripeHeaders(config)),
      ),
    );
    const body = yield* readJsonBody(response);
    if (response.status >= 400) {
      return yield* failStripeResponse(response.status, body);
    }
    return body as A;
  });

const stripeRequestForm = <A>(
  config: StripeCredentialsConfig,
  path: string,
  params: URLSearchParams,
  options: StripeRequestOptions | undefined,
): Effect.Effect<A, StripeClientError, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const response = yield* executeStripeRequest(
      HttpClientRequest.post(stripeApiUrl(config, path)).pipe(
        HttpClientRequest.setHeaders(stripeHeaders(config, options)),
        HttpClientRequest.bodyUrlParams(params),
      ),
    );
    const body = yield* readJsonBody(response);
    if (response.status >= 400) {
      return yield* failStripeResponse(response.status, body);
    }
    return body as A;
  });

const deleteStripeObject = (config: StripeCredentialsConfig, path: string) =>
  Effect.gen(function* () {
    const response = yield* executeStripeRequest(
      HttpClientRequest.delete(stripeApiUrl(config, path)).pipe(
        HttpClientRequest.setHeaders(stripeHeaders(config)),
      ),
    );
    if (response.status < 400) return;
    const body = yield* readJsonBody(response);
    return yield* failStripeResponse(response.status, body);
  });

const pathPart = (value: string) => encodeURIComponent(value);

type RawListPricesInput = ListPricesInput & {
  readonly starting_after?: string;
  readonly limit?: number;
};

const appendFormValue = (
  params: URLSearchParams,
  key: string,
  value: unknown,
) => {
  if (value !== undefined) params.append(key, String(value));
};

const appendMetadataForm = (params: URLSearchParams, metadata: unknown) => {
  if (!Predicate.isObject(metadata)) return;
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value !== "string") continue;
    params.append(`metadata[${key}]`, value);
  }
};

const appendStringArrayForm = (
  params: URLSearchParams,
  key: string,
  value: readonly string[] | "" | undefined,
) => {
  if (value === undefined) return;
  if (value === "" || value.length === 0) {
    params.append(key, "");
    return;
  }
  for (const item of value) {
    params.append(`${key}[]`, item);
  }
};

const appendMarketingFeaturesForm = (
  params: URLSearchParams,
  value: readonly { readonly name?: string }[] | "" | undefined,
) => {
  if (value === undefined) return;
  if (value === "" || value.length === 0) {
    params.append("marketing_features", "");
    return;
  }
  value.forEach((feature, index) => {
    if (feature.name !== undefined) {
      params.append(`marketing_features[${index}][name]`, feature.name);
    }
  });
};

const productUpdateForm = (input: UpdateProductInput) => {
  const params = new URLSearchParams();
  appendFormValue(params, "active", input.active);
  appendFormValue(params, "default_price", input.default_price);
  appendFormValue(params, "description", input.description);
  appendStringArrayForm(params, "images", input.images);
  appendMetadataForm(params, input.metadata);
  appendMarketingFeaturesForm(params, input.marketing_features);
  appendFormValue(params, "name", input.name);
  appendFormValue(params, "shippable", input.shippable);
  appendFormValue(params, "statement_descriptor", input.statement_descriptor);
  appendFormValue(params, "tax_code", input.tax_code);
  appendFormValue(params, "unit_label", input.unit_label);
  appendFormValue(params, "url", input.url);
  return params;
};

const rawListPrices = (
  config: StripeCredentialsConfig,
  input: RawListPricesInput,
) => {
  const params = new URLSearchParams(
    UrlParams.toString(
      UrlParams.fromInput({
        active: input.active,
        created: input.created,
        currency: input.currency,
        ending_before: input.ending_before,
        limit: input.limit,
        product: input.product,
        starting_after: input.starting_after,
        type: input.type,
      }),
    ),
  );
  for (const lookupKey of input.lookupKeys ?? []) {
    params.append("lookup_keys[]", lookupKey);
  }
  const query = params.size === 0 ? "" : `?${params.toString()}`;
  return stripeRequestJson<{
    readonly data: readonly StripePrice[];
    readonly has_more: boolean;
  }>(config, `/v1/prices${query}`);
};

const shouldUseRawListPrices = (input: ListPricesInput | undefined) =>
  input?.lookupKeys !== undefined || Predicate.isObject(input?.created);

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
        stripeRequestForm<StripeProduct>(
          config,
          `/v1/products/${pathPart(input.id)}`,
          productUpdateForm(input),
          options,
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
      run(deleteStripeObject(config, `/v1/products/${pathPart(id)}`)),

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
      !shouldUseRawListPrices(input)
        ? Effect.sync(() => {
            const { created, lookupKeys: _lookupKeys, ...rest } = input ?? {};
            return {
              ...rest,
              ...(created === undefined
                ? {}
                : { created: created as GetPricesInput["created"] }),
            } satisfies Omit<GetPricesInput, "starting_after">;
          }).pipe(
            Effect.flatMap((generatedInput) =>
              run(
                collectPaginated<StripePrice, GetPricesInput>(
                  (cursor) =>
                    ({
                      ...generatedInput,
                      limit: 100,
                      ...(cursor === undefined
                        ? {}
                        : { starting_after: cursor }),
                    }) satisfies GetPricesInput,
                  GetPrices,
                ),
              ),
            ),
          )
        : run(
            Effect.gen(function* () {
              const prices: StripePrice[] = [];
              let cursor: string | undefined;

              do {
                const page = yield* rawListPrices(config, {
                  ...input,
                  limit: 100,
                  ...(cursor === undefined ? {} : { starting_after: cursor }),
                });
                prices.push(...page.data);
                cursor = page.has_more
                  ? paginationCursor(page.data)
                  : undefined;
                if (page.has_more && cursor === undefined) {
                  return yield* Effect.fail(
                    new UnknownStripeError({
                      body: {
                        message:
                          "Stripe pagination returned has_more without a cursor.",
                      },
                    }),
                  );
                }
              } while (cursor !== undefined);

              return prices;
            }),
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
        deleteStripeObject(
          config,
          `/v1/products/${pathPart(product)}/features/${pathPart(id)}`,
        ),
      ),

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
      run(deleteStripeObject(config, `/v1/webhook_endpoints/${pathPart(id)}`)),
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
