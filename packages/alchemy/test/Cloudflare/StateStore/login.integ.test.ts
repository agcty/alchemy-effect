import StateStoreStack from "@/Cloudflare/StateStore/Stack.ts";
import { StateApi } from "@/State/HttpStateApi.ts";
import * as CfCredentials from "@distilled.cloud/cloudflare/Credentials";
import { CloudflareEnvironment } from "alchemy/Cloudflare";
import {
  HttpStateStore,
  HttpStateStoreAuth,
  loginWithCloudflare,
} from "alchemy/State";
import {
  afterAll,
  beforeAll,
  deploy,
  destroy,
  expect,
  test,
} from "alchemy/Test/Bun";
import * as Data from "effect/Data";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schedule from "effect/Schedule";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import TestStack from "./TestStack/Stack.ts";

// ---- errors ------------------------------------------------------

class StateStoreRpcError extends Data.TaggedError("StateStoreRpcError")<{
  readonly method: string;
  readonly status: number;
  readonly code?: string;
  readonly message: string;
  readonly body: string;
}> {}

class WorkerNotReachable extends Data.TaggedError("WorkerNotReachable")<{
  readonly url: string;
  readonly reason: string;
}> {}

// ---- downstream stack metadata -----------------------------------

/**
 * `TestStack` uses stack name `AlchemyStateStoreLoginTest` and the
 * test harness hardcodes stage `"test"` — those become the keys the
 * HTTP state-store sees.
 */
const DOWNSTREAM_STACK_NAME = "AlchemyStateStoreLoginTest";
const DOWNSTREAM_STAGE = "test";

// ---- layers ------------------------------------------------------

/**
 * Composed layer that makes `State` resolve to the HTTP state store.
 * Provided to `deploy(TestStack)` / `destroy(TestStack)` so the
 * downstream stack's state lives in our service, not on local disk.
 *
 * `HttpStateStoreAuth` registers the auth provider into the
 * `AuthProviders` registry first; `HttpStateStore` then reads the
 * credentials (written by `loginWithCloudflare`) to build its
 * `StateService`.
 */
const remoteState = HttpStateStore.pipe(Layer.provide(HttpStateStoreAuth));

/**
 * Minimal Cloudflare runtime for `loginWithCloudflare`. We avoid the
 * full `Cloudflare.providers()` layer because it transitively pulls
 * in `Stack`/`Stage`/`DotAlchemy` — services only plumbed inside
 * `deploy()`, not in a bare test body. All we actually need for the
 * login is `CloudflareEnvironment` + the distilled `Credentials`
 * service, both satisfiable from env vars.
 */
const cloudflareForLogin = Layer.mergeAll(
  CfCredentials.fromEnv(),
  Layer.succeed(CloudflareEnvironment, {
    type: "apiToken" as const,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    apiToken: Redacted.make(process.env.CLOUDFLARE_API_TOKEN!),
    source: { type: "env" as const },
  }),
);

// ---- Effect-native HTTP helpers ----------------------------------

/**
 * Build a typed `StateApi` client targetting the deployed worker.
 * Failures surface as typed `StateStoreRpcError` so callers can
 * `Effect.retry` / `catchTag` cleanly.
 */
const stateClient = (baseUrl: string, token: string) =>
  HttpApiClient.make(StateApi, {
    baseUrl,
    transformClient: HttpClient.mapRequest(
      HttpClientRequest.bearerToken(token),
    ),
  }).pipe(Effect.provide(FetchHttpClient.layer));

const wrapErr = (method: string) =>
  Effect.mapError(
    (e: unknown) =>
      new StateStoreRpcError({
        method,
        status: 0,
        message: e instanceof Error ? e.message : String(e),
        body: "",
      }),
  );

/** `list` for `(stack, stage)` — always returns an array. */
const listFqns = (
  baseUrl: string,
  token: string,
  stateStack: string,
  stage: string,
) =>
  stateClient(baseUrl, token).pipe(
    Effect.flatMap((client) =>
      client.state.listResources({
        payload: { stack: stateStack, stage },
      }),
    ),
    Effect.map((fqns) => [...fqns]),
    wrapErr("list"),
  );

/** `listStacks` — always returns an array. */
const listStacks = (baseUrl: string, token: string) =>
  stateClient(baseUrl, token).pipe(
    Effect.flatMap((client) => client.state.listStacks()),
    Effect.map((stacks) => [...stacks]),
    wrapErr("listStacks"),
  );

/**
 * Retry options for newly-deployed workers: up to 60 attempts with
 * a 2-second spacing (~2 minutes total).
 */
const warmupRetry = {
  times: 60,
  schedule: Schedule.spaced(Duration.seconds(2)),
} as const;

/**
 * Poll an authenticated RPC path until it responds with a valid
 * envelope. Without this, the first request after deploy can hit
 * Cloudflare's edge before the workers.dev subdomain is propagated
 * and return an HTML error page.
 */
const waitForWorker = (url: string, token: string) =>
  listStacks(url, token).pipe(
    Effect.retry(warmupRetry),
    Effect.mapError(
      () =>
        new WorkerNotReachable({
          url,
          reason: "RPC path not warm after retries",
        }),
    ),
    Effect.asVoid,
  );

/**
 * Poll a newly-deployed workers.dev URL until it returns 200 with a
 * body containing `needle`. Cloudflare serves an HTML error page for
 * the first few seconds after a fresh deploy, so a single fetch is
 * unreliable.
 */
const waitForBody = (url: string, needle: string) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const response = yield* client.get(url);
    const body = yield* response.text;
    if (response.status !== 200 || !body.includes(needle)) {
      return yield* Effect.fail(
        new WorkerNotReachable({
          url,
          reason: `status=${response.status}, body did not contain needle`,
        }),
      );
    }
    return body;
  }).pipe(
    Effect.retry(warmupRetry),
    Effect.mapError(
      () =>
        new WorkerNotReachable({
          url,
          reason: `did not return expected body after retries`,
        }),
    ),
  );

// ---- beforeAll / afterAll ---------------------------------------

/**
 * Deploy the state-store stack itself. Uses the test harness's
 * `LocalState`; resources it creates end up in `.alchemy/state/`.
 */
const stack = beforeAll(
  Effect.gen(function* () {
    const output = yield* deploy(StateStoreStack);
    const url = output.url as string;
    const authToken = output.authToken as string;
    yield* waitForWorker(url, authToken);
    return { url, authToken };
  }),
  { timeout: 180_000 },
);

// Skip teardown with NO_DESTROY=1 for local iteration.
afterAll.skipIf(!!process.env.NO_DESTROY)(destroy(StateStoreStack), {
  timeout: 180_000,
});

// ---- the actual scenario ----------------------------------------

test(
  "spin up → login → deploy downstream worker → verify state → teardown",
  Effect.gen(function* () {
    const { url: stateStoreUrl, authToken } = yield* stack;

    // 1. Log in. Uses `loginWithCloudflare` (edge-preview probe →
    //    token, subdomain lookup → URL) and writes
    //    `~/.alchemy/credentials/default/http-state-store.json`.
    //
    //    `cloudflareForLogin` provides the minimum set of services
    //    `loginWithCloudflare` needs beyond what the test harness
    //    already supplies.
    yield* loginWithCloudflare.pipe(Effect.provide(cloudflareForLogin));

    // 2. State store should be empty for the downstream stack before
    //    we deploy anything.
    const before = yield* listFqns(
      stateStoreUrl,
      authToken,
      DOWNSTREAM_STACK_NAME,
      DOWNSTREAM_STAGE,
    );
    expect(before).toEqual([]);

    // 3. Deploy the downstream worker — its state goes to our HTTP
    //    state store, not local disk. Providing `remoteState` here
    //    overrides the harness's default `LocalState` for this call
    //    (inner `Effect.provide` wins).
    const deployed = yield* deploy(TestStack).pipe(Effect.provide(remoteState));
    const workerUrl = deployed.url as string;
    expect(workerUrl).toBeString();

    // 4. State store should now have at least one resource recorded
    //    for the downstream stack/stage, and the stack should be
    //    listed in the root index.
    const afterDeploy = yield* listFqns(
      stateStoreUrl,
      authToken,
      DOWNSTREAM_STACK_NAME,
      DOWNSTREAM_STAGE,
    );
    expect(afterDeploy.length).toBeGreaterThan(0);

    const stacksList = yield* listStacks(stateStoreUrl, authToken);
    expect(stacksList).toContain(DOWNSTREAM_STACK_NAME);

    // 5. Hit the worker itself — it should respond 200 with the
    //    canary string defined in `TestStack`. `waitForBody` polls
    //    until the workers.dev subdomain is propagated so we don't
    //    read a Cloudflare edge error page.
    const body = yield* waitForBody(workerUrl, "state-store-test-worker OK");
    expect(body).toContain("state-store-test-worker OK");

    // 6. Tear down the downstream stack. Same override so `destroy`
    //    reads/writes the HTTP state store.
    yield* destroy(TestStack).pipe(Effect.provide(remoteState));

    // 7. State store should be empty again for this stack after
    //    teardown. The stack name may still appear in `listStacks` —
    //    the root index is write-only today to match LocalState's
    //    "directories aren't auto-removed" semantics.
    const afterDestroy = yield* listFqns(
      stateStoreUrl,
      authToken,
      DOWNSTREAM_STACK_NAME,
      DOWNSTREAM_STAGE,
    );
    expect(afterDestroy).toEqual([]);
  }),
  { timeout: 300_000 },
);
