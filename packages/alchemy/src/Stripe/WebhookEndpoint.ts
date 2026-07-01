import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { Unowned } from "../AdoptPolicy.ts";
import { deepEqual, isResolved } from "../Diff.ts";
import * as Provider from "../Provider.ts";
import { Resource } from "../Resource.ts";
import {
  DEFAULT_STRIPE_API_VERSION,
  StripeClient,
  type StripeClientService,
  type StripeWebhookEndpoint,
} from "./Client.ts";
import { ResourceNotOwnedError } from "./Errors.ts";
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
  type Ownership,
  sortedStringsEqual,
  stripOwnershipMetadata,
  type StripeMetadata,
  withOwnershipMetadata,
} from "./Util.ts";

export interface WebhookEndpointProps {
  readonly url: string;
  readonly enabledEvents: readonly string[];
  readonly apiVersion?: string;
  readonly connect?: boolean;
  readonly description?: string;
  readonly disabled?: boolean;
  readonly metadata?: StripeMetadata;
}

export interface WebhookEndpointAttributes {
  readonly id: string;
  readonly url: string;
  readonly enabledEvents: readonly string[];
  readonly apiVersion?: string;
  readonly application?: string;
  readonly created: number;
  readonly description?: string;
  readonly disabled: boolean;
  readonly livemode: boolean;
  readonly metadata: StripeMetadata;
  readonly status: string;
  /**
   * Stripe returns the signing secret only on create. It is preserved from
   * state on later reads when available.
   */
  readonly secret?: Redacted.Redacted<string>;
}

export type WebhookEndpoint = Resource<
  "Stripe.WebhookEndpoint",
  WebhookEndpointProps,
  WebhookEndpointAttributes,
  never,
  Providers
>;

/**
 * A Stripe Webhook Endpoint.
 *
 * The endpoint's signing secret is returned by Stripe only during creation.
 * Alchemy captures it as a redacted output if Stripe returns it, then preserves
 * the state value on subsequent reads.
 *
 * Prefer an explicit `enabledEvents` allowlist. `["*"]` works but couples your
 * Worker to every future Stripe event.
 *
 * @resource
 * @see https://docs.stripe.com/api/webhook_endpoints
 */
export const WebhookEndpoint = Resource<WebhookEndpoint>(
  "Stripe.WebhookEndpoint",
);

type CreateWebhookInput = Parameters<
  StripeClientService["createWebhookEndpoint"]
>[0];
type StripeWebhookEnabledEvent = CreateWebhookInput["enabled_events"][number];
type StripeWebhookApiVersion = NonNullable<CreateWebhookInput["api_version"]>;

const toRedacted = (
  secret: string | Redacted.Redacted<string> | undefined,
): Redacted.Redacted<string> | undefined => {
  if (secret === undefined) return undefined;
  return Redacted.isRedacted(secret) ? secret : Redacted.make(secret);
};

const toAttributes = (
  endpoint: StripeWebhookEndpoint,
  preservedSecret?: Redacted.Redacted<string>,
): WebhookEndpointAttributes => ({
  id: endpoint.id,
  url: endpoint.url,
  enabledEvents: endpoint.enabled_events,
  apiVersion: defined(endpoint.api_version),
  application: defined(endpoint.application),
  created: endpoint.created,
  description: defined(endpoint.description),
  disabled: endpoint.status !== "enabled",
  livemode: endpoint.livemode,
  metadata: stripOwnershipMetadata(endpoint.metadata),
  status: endpoint.status,
  secret: toRedacted(endpoint.secret) ?? preservedSecret,
});

const toGeneratedEnabledEvents = (events: readonly string[]) =>
  [...events] as StripeWebhookEnabledEvent[];

const toGeneratedApiVersion = (apiVersion: string) =>
  apiVersion as StripeWebhookApiVersion;

const mutableShape = (props: WebhookEndpointProps | undefined) => ({
  url: props?.url,
  enabledEvents: [...(props?.enabledEvents ?? [])].sort(),
  description: props?.description,
  disabled: props?.disabled,
  metadata: props?.metadata,
});

const immutableShape = (props: WebhookEndpointProps | undefined) => ({
  apiVersion:
    props === undefined
      ? undefined
      : (props.apiVersion ?? DEFAULT_STRIPE_API_VERSION),
  connect: props?.connect ?? false,
});

const observedImmutableShape = (endpoint: StripeWebhookEndpoint) => ({
  apiVersion: defined(endpoint.api_version) ?? DEFAULT_STRIPE_API_VERSION,
  connect: false,
});

const isExpectedWebhookGeneration = (
  endpoint: StripeWebhookEndpoint,
  props: WebhookEndpointProps,
  fingerprint: string,
) => {
  const observedFingerprint = getMetadataFingerprint(endpoint.metadata);
  return observedFingerprint === undefined
    ? deepEqual(observedImmutableShape(endpoint), immutableShape(props))
    : observedFingerprint === fingerprint;
};

export const WebhookEndpointProvider = () =>
  Provider.effect(
    WebhookEndpoint,
    Effect.gen(function* () {
      const client = yield* StripeClient;

      const updateEndpoint = (
        endpointId: string,
        props: WebhookEndpointProps,
        current: StripeWebhookEndpoint,
        metadata: StripeMetadata,
      ) =>
        client.updateWebhookEndpoint({
          webhook_endpoint: endpointId,
          url: props.url,
          enabled_events: toGeneratedEnabledEvents(props.enabledEvents),
          description: clearableStringForUpdate(
            defined(current.description),
            props.description,
          ),
          disabled: props.disabled ?? false,
          metadata: metadataForUpdate(current.metadata, metadata),
        });

      const deleteStaleOwnedEndpoints = (
        endpoints: readonly StripeWebhookEndpoint[],
        ownership: Ownership,
        keepId: string,
      ) =>
        Effect.forEach(
          endpoints.filter(
            (endpoint) =>
              endpoint.id !== keepId && isOwnedBy(endpoint.metadata, ownership),
          ),
          (endpoint) =>
            client
              .deleteWebhookEndpoint(endpoint.id)
              .pipe(Effect.catchIf(isStripeNotFound, () => Effect.void)),
          { discard: true },
        );

      return {
        stables: ["id", "livemode"],
        list: Effect.fn(function* () {
          const endpoints = yield* client.listWebhookEndpoints();
          return endpoints
            .filter((endpoint) => endpoint.metadata.alchemy_stack !== undefined)
            .map((endpoint) => toAttributes(endpoint));
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
        reconcile: Effect.fn(function* ({ id, news, output }) {
          const ownership = yield* currentOwnership();
          const fingerprint = yield* createMetadataFingerprint(
            immutableShape(news),
          );
          const metadata = withOwnershipMetadata(news.metadata, ownership, {
            fingerprint,
          });
          const ownedEndpoints =
            output === undefined
              ? yield* client
                  .listWebhookEndpoints()
                  .pipe(
                    Effect.map((endpoints) =>
                      endpoints.filter((endpoint) =>
                        isOwnedBy(endpoint.metadata, ownership),
                      ),
                    ),
                  )
              : [];
          const observed = output?.id
            ? yield* client
                .getWebhookEndpoint(output.id)
                .pipe(
                  Effect.catchIf(isStripeNotFound, () =>
                    Effect.succeed(undefined),
                  ),
                )
            : ownedEndpoints.find((endpoint) =>
                isExpectedWebhookGeneration(endpoint, news, fingerprint),
              );

          if (observed === undefined) {
            const createInput = {
              url: news.url,
              enabled_events: toGeneratedEnabledEvents(news.enabledEvents),
              api_version: toGeneratedApiVersion(
                news.apiVersion ?? DEFAULT_STRIPE_API_VERSION,
              ),
              connect: news.connect,
              description: news.description,
              metadata,
            };
            const created = yield* client.createWebhookEndpoint(createInput, {
              idempotencyKey: yield* createIdempotencyKey(
                "webhook-endpoint",
                id,
                createInput,
              ),
            });
            if (news.disabled !== true) {
              yield* deleteStaleOwnedEndpoints(
                ownedEndpoints,
                ownership,
                created.id,
              );
              return toAttributes(created);
            }
            const updated = yield* updateEndpoint(
              created.id,
              news,
              created,
              metadata,
            );
            yield* deleteStaleOwnedEndpoints(
              ownedEndpoints,
              ownership,
              updated.id,
            );
            return toAttributes(updated, toRedacted(created.secret));
          }

          if (
            output === undefined &&
            !isOwnedBy(observed.metadata, ownership)
          ) {
            return yield* Effect.fail(
              new ResourceNotOwnedError({
                resourceType: "Stripe.WebhookEndpoint",
                resourceId: observed.id,
                message: `Stripe webhook endpoint '${observed.id}' exists but is not owned by this stack.`,
              }),
            );
          }

          const needsUpdate =
            observed.url !== news.url ||
            !sortedStringsEqual(observed.enabled_events, news.enabledEvents) ||
            observed.description !== (news.description ?? null) ||
            (observed.status !== "enabled") !== (news.disabled ?? false) ||
            !deepEqual(
              stripOwnershipMetadata(observed.metadata),
              news.metadata ?? {},
            );

          const next = needsUpdate
            ? yield* updateEndpoint(observed.id, news, observed, metadata)
            : observed;
          if (output === undefined) {
            yield* deleteStaleOwnedEndpoints(
              ownedEndpoints,
              ownership,
              next.id,
            );
          }
          return toAttributes(next, output?.secret);
        }),
        read: Effect.fn(function* ({ olds, output }) {
          const ownership = yield* currentOwnership();
          const fingerprint = yield* createMetadataFingerprint(
            immutableShape(olds),
          );
          const endpoint = output?.id
            ? yield* client
                .getWebhookEndpoint(output.id)
                .pipe(
                  Effect.catchIf(isStripeNotFound, () =>
                    Effect.succeed(undefined),
                  ),
                )
            : yield* client
                .listWebhookEndpoints()
                .pipe(
                  Effect.map((endpoints) =>
                    endpoints.find(
                      (endpoint) =>
                        isOwnedBy(endpoint.metadata, ownership) &&
                        isExpectedWebhookGeneration(
                          endpoint,
                          olds,
                          fingerprint,
                        ),
                    ),
                  ),
                );
          if (!endpoint) return undefined;

          const attrs = toAttributes(endpoint, output?.secret);
          return isOwnedBy(endpoint.metadata, ownership)
            ? attrs
            : Unowned(attrs);
        }),
        delete: Effect.fn(function* ({ output }) {
          yield* client
            .deleteWebhookEndpoint(output.id)
            .pipe(Effect.catchIf(isStripeNotFound, () => Effect.void));
        }),
      };
    }),
  );
