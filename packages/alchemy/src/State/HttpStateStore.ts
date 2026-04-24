import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import {
  ALCHEMY_PROFILE,
  getAuthProvider,
  loadOrConfigure,
} from "../Auth/index.ts";
import { StateApi } from "./HttpStateApi.ts";
import {
  HTTP_STATE_STORE_AUTH_PROVIDER_NAME,
  type HttpStateStoreAuthConfig,
  type HttpStateStoreResolvedCredentials,
} from "./HttpStateStoreAuth.ts";
import type { ReplacedResourceState, ResourceState } from "./ResourceState.ts";
import { State, StateStoreError, type StateService } from "./State.ts";
import { encodeState, reviveStateRecursive } from "./StateEncoding.ts";

/**
 * Layer that implements {@link State} by issuing requests against an
 * HTTP state-store server through Effect's `HttpApiClient` derived
 * from {@link StateApi}. Credentials (URL, bearer token) are resolved
 * through the {@link HttpStateStoreAuth} provider.
 *
 * Build {@link HttpStateStoreAuth} alongside this layer so the
 * provider is registered before the state-store resolves its config.
 * A `FetchHttpClient.layer` is provided for the underlying transport
 * so consumers don't need to wire one up themselves.
 *
 * `Redacted<T>` values inside arbitrary `props`/`attr` records
 * round-trip via a `{ __redacted__: ... }` envelope handled here at
 * the client boundary. The state-store wire itself treats
 * `ResourceState` as opaque JSON.
 */
export const HttpStateStore = Layer.effect(
  State,
  Effect.gen(function* () {
    const auth = yield* getAuthProvider<
      HttpStateStoreAuthConfig,
      HttpStateStoreResolvedCredentials
    >(HTTP_STATE_STORE_AUTH_PROVIDER_NAME);
    const profileName = yield* ALCHEMY_PROFILE;
    const ci = yield* Config.boolean("CI").pipe(Config.withDefault(false));
    const config = yield* loadOrConfigure(auth, profileName, { ci });
    const creds = yield* auth.read(
      profileName,
      config as HttpStateStoreAuthConfig,
    );

    const baseUrl = creds.url.replace(/\/+$/, "");
    const token = Redacted.value(creds.token);

    const apiClient = yield* HttpApiClient.make(StateApi, {
      baseUrl,
      transformClient: HttpClient.mapRequest(
        HttpClientRequest.bearerToken(token),
      ),
    });
    const state = apiClient.state;

    const service: StateService = {
      listStacks: () =>
        state.listStacks().pipe(
          Effect.map((stacks) => [...stacks]),
          mapStateStoreError,
        ),
      listStages: (stack) =>
        state.listStages({ payload: { stack } }).pipe(mapStateStoreError),
      list: (request) =>
        state.listResources({ payload: request }).pipe(mapStateStoreError),
      get: (request) =>
        state.getState({ payload: request }).pipe(
          Effect.map((s) =>
            s == null ? undefined : (reviveStateRecursive(s) as ResourceState),
          ),
          mapStateStoreError,
        ),
      getReplacedResources: (request) =>
        state.getReplacedResources({ payload: request }).pipe(
          Effect.map((resources) =>
            resources.map(
              (s) => reviveStateRecursive(s) as ReplacedResourceState,
            ),
          ),
          mapStateStoreError,
        ),
      set: <V extends ResourceState>(request: {
        stack: string;
        stage: string;
        fqn: string;
        value: V;
      }) =>
        state
          .setState({
            payload: {
              stack: request.stack,
              stage: request.stage,
              fqn: request.fqn,
              value: encodeState(request.value),
            },
          })
          .pipe(
            // Server echoes the stored value, but the client already
            // has the canonical object (including any Redacted<T>
            // instances); returning the input avoids a lossy round-trip.
            Effect.map(() => request.value),
            mapStateStoreError,
          ),
      delete: (request) =>
        state
          .deleteState({ payload: request })
          .pipe(Effect.asVoid, mapStateStoreError),
    };
    return service;
  }),
).pipe(Layer.provide(FetchHttpClient.layer));

/** Collapse any client failure into a {@link StateStoreError}. */
const mapStateStoreError = <A, E, R>(eff: Effect.Effect<A, E, R>) =>
  Effect.catch(eff, (e: E) =>
    Effect.fail(
      new StateStoreError({
        message: e instanceof Error ? e.message : String(e),
        cause: e instanceof Error ? e : undefined,
      }),
    ),
  ) as Effect.Effect<A, StateStoreError, R>;
