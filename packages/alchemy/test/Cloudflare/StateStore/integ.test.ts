import Stack from "@/Cloudflare/StateStore/Stack.ts";
import { StateApi } from "@/State/HttpStateApi";
import type { ResourceState } from "alchemy/State";
import {
  afterAll,
  beforeAll,
  deploy,
  destroy,
  expect,
  test,
} from "alchemy/Test/Bun";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

const stack = beforeAll(
  Effect.gen(function* () {
    const output = yield* deploy(Stack);
    const url = output.url as string;
    const authToken = output.authToken as string;
    yield* Effect.promise(() => waitForWorker(url, authToken));
    return { url, authToken };
  }),
  { timeout: 180_000 },
);

// Skip teardown with NO_DESTROY=1 for local iteration.
afterAll.skipIf(!!process.env.NO_DESTROY)(destroy(Stack), { timeout: 180_000 });

async function waitForWorker(url: string, token: string, maxRetries = 60) {
  // Probe an authenticated endpoint until it responds with JSON. The
  // Secrets Store bindings and Durable Object namespace may take a
  // moment to become consistent after deploy.
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${url}/state/listStacks`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      const text = await res.text();
      if (res.status === 200 && text.startsWith("[")) {
        const json = JSON.parse(text);
        if (Array.isArray(json)) return;
      }
    } catch {
      // network / 521 / 522 — keep retrying
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Worker endpoint not warm after retries");
}

// ----------------------------------------------------------- helpers --

/**
 * Build a typed `StateApi` client targetting the deployed worker.
 * Each test wires its own client (rather than reusing a shared one)
 * to keep the bearer token explicit and avoid hidden state.
 */
const stateClient = (baseUrl: string, token: string) =>
  HttpApiClient.make(StateApi, {
    baseUrl,
    transformClient: HttpClient.mapRequest(
      HttpClientRequest.bearerToken(token),
    ),
  }).pipe(Effect.provide(FetchHttpClient.layer));

/**
 * Build a valid `CreatedResourceState` for use in `set` tests. Every
 * field that `BaseResourceState` requires is populated so the object
 * round-trips correctly through JSON.
 */
const makeResource = (
  logicalId: string,
  overrides: Partial<ResourceState> = {},
): ResourceState =>
  ({
    resourceType: "Test.Resource",
    namespace: undefined,
    fqn: logicalId,
    logicalId,
    instanceId: `${logicalId}-instance`,
    providerVersion: 1,
    status: "created",
    downstream: [],
    bindings: [],
    props: { foo: "bar" },
    attr: { id: logicalId },
    ...overrides,
  }) as ResourceState;

// Use a unique stack name per test so tests don't interfere with each
// other (each stack gets its own Durable Object).
let stackCounter = 0;
const uniqueStack = () => `test-stack-${++stackCounter}-${Date.now()}`;

// ----------------------------------------------------------- tests --

test(
  "rejects requests missing the bearer token with 401",
  Effect.gen(function* () {
    const { url } = yield* stack;
    const res = yield* Effect.promise(() =>
      fetch(`${url}/state/listStacks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(401);
  }),
);

test(
  "rejects requests with a wrong bearer token with 401",
  Effect.gen(function* () {
    const { url } = yield* stack;
    const res = yield* Effect.promise(() =>
      fetch(`${url}/state/listStacks`, {
        method: "POST",
        headers: {
          Authorization: "Bearer not-the-real-token",
          "Content-Type": "application/json",
        },
        body: "{}",
      }),
    );
    expect(res.status).toBe(401);
  }),
);

test(
  "returns 404 for unknown routes",
  Effect.gen(function* () {
    const { url, authToken } = yield* stack;
    const res = yield* Effect.promise(() =>
      fetch(`${url}/does/not/exist`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      }),
    );
    expect(res.status).toBe(404);
  }),
);

test(
  "set + get + delete round-trip for a single resource",
  Effect.gen(function* () {
    const { url, authToken } = yield* stack;
    const stackName = uniqueStack();
    const resource = makeResource("my-resource");
    const client = (yield* stateClient(url, authToken)).state;
    const key = { stack: stackName, stage: "dev", fqn: "my-resource" };

    const g0 = yield* client.getState({ payload: key });
    expect(g0).toBeNull();

    const s1 = (yield* client.setState({
      payload: { ...key, value: resource },
    })) as ResourceState;
    expect(s1.logicalId).toBe("my-resource");
    expect(s1.resourceType).toBe("Test.Resource");

    const g1 = (yield* client.getState({ payload: key })) as ResourceState;
    expect(g1.logicalId).toBe("my-resource");
    expect((g1 as any).props.foo).toBe("bar");

    yield* client.deleteState({ payload: key });

    const g2 = yield* client.getState({ payload: key });
    expect(g2).toBeNull();
  }),
);

test(
  "delete is idempotent for missing keys",
  Effect.gen(function* () {
    const { url, authToken } = yield* stack;
    const client = (yield* stateClient(url, authToken)).state;
    yield* client.deleteState({
      payload: {
        stack: uniqueStack(),
        stage: "dev",
        fqn: "never-existed",
      },
    });
  }),
);

test(
  "list returns FQNs for a given (stack, stage)",
  Effect.gen(function* () {
    const { url, authToken } = yield* stack;
    const stackName = uniqueStack();
    const client = (yield* stateClient(url, authToken)).state;

    yield* client.setState({
      payload: {
        stack: stackName,
        stage: "dev",
        fqn: "a",
        value: makeResource("a"),
      },
    });
    yield* client.setState({
      payload: {
        stack: stackName,
        stage: "dev",
        fqn: "parent/b",
        value: makeResource("b"),
      },
    });
    // different stage should not appear
    yield* client.setState({
      payload: {
        stack: stackName,
        stage: "prod",
        fqn: "c",
        value: makeResource("c"),
      },
    });

    const res = yield* client.listResources({
      payload: { stack: stackName, stage: "dev" },
    });
    expect([...res].sort()).toEqual(["a", "parent/b"]);
  }),
);

test(
  "listStages returns stages for a stack; listStacks returns registered stacks",
  Effect.gen(function* () {
    const { url, authToken } = yield* stack;
    const alpha = uniqueStack();
    const beta = uniqueStack();
    const client = (yield* stateClient(url, authToken)).state;

    yield* client.setState({
      payload: {
        stack: alpha,
        stage: "dev",
        fqn: "r1",
        value: makeResource("r1"),
      },
    });
    yield* client.setState({
      payload: {
        stack: alpha,
        stage: "prod",
        fqn: "r2",
        value: makeResource("r2"),
      },
    });
    yield* client.setState({
      payload: {
        stack: beta,
        stage: "dev",
        fqn: "r3",
        value: makeResource("r3"),
      },
    });

    const stacks = yield* client.listStacks();
    // Other parallel tests may also register their own stacks, so
    // just assert our two are present.
    expect(stacks).toContain(alpha);
    expect(stacks).toContain(beta);

    const stagesAlpha = yield* client.listStages({
      payload: { stack: alpha },
    });
    expect([...stagesAlpha].sort()).toEqual(["dev", "prod"]);

    const stagesBeta = yield* client.listStages({
      payload: { stack: beta },
    });
    expect([...stagesBeta].sort()).toEqual(["dev"]);

    const stagesMissing = yield* client.listStages({
      payload: { stack: "not-a-stack" },
    });
    expect(stagesMissing).toEqual([]);
  }),
);

test(
  "set on an existing key overwrites the value",
  Effect.gen(function* () {
    const { url, authToken } = yield* stack;
    const stackName = uniqueStack();
    const client = (yield* stateClient(url, authToken)).state;
    const key = { stack: stackName, stage: "e", fqn: "f" };

    yield* client.setState({
      payload: { ...key, value: makeResource("f", { props: { v: 1 } as any }) },
    });
    yield* client.setState({
      payload: { ...key, value: makeResource("f", { props: { v: 2 } as any }) },
    });

    const res = (yield* client.getState({ payload: key })) as ResourceState;
    expect((res as any).props.v).toBe(2);
  }),
);

test(
  "getReplacedResources filters to status === 'replaced'",
  Effect.gen(function* () {
    const { url, authToken } = yield* stack;
    const stackName = uniqueStack();
    const client = (yield* stateClient(url, authToken)).state;

    yield* client.setState({
      payload: {
        stack: stackName,
        stage: "e",
        fqn: "created",
        value: makeResource("created", { status: "created" }),
      },
    });
    yield* client.setState({
      payload: {
        stack: stackName,
        stage: "e",
        fqn: "replaced-one",
        value: makeResource("replaced-one", {
          status: "replaced",
          deleteFirst: false,
          old: {
            status: "created",
            resourceType: "Test.Resource",
            namespace: undefined,
            fqn: "replaced-one",
            logicalId: "replaced-one",
            instanceId: "old-instance",
            providerVersion: 1,
            downstream: [],
            bindings: [],
            props: {},
            attr: {},
          },
        } as any),
      },
    });
    yield* client.setState({
      payload: {
        stack: stackName,
        stage: "e",
        fqn: "replaced-two",
        value: makeResource("replaced-two", {
          status: "replaced",
          deleteFirst: true,
          old: {
            status: "created",
            resourceType: "Test.Resource",
            namespace: undefined,
            fqn: "replaced-two",
            logicalId: "replaced-two",
            instanceId: "old-instance-2",
            providerVersion: 1,
            downstream: [],
            bindings: [],
            props: {},
            attr: {},
          },
        } as any),
      },
    });

    const res = yield* client.getReplacedResources({
      payload: { stack: stackName, stage: "e" },
    });
    const ids = res.map((r) => (r as any).logicalId).sort();
    expect(ids).toEqual(["replaced-one", "replaced-two"]);
  }),
);

test(
  "stacks are isolated from each other",
  Effect.gen(function* () {
    const { url, authToken } = yield* stack;
    const stackA = uniqueStack();
    const stackB = uniqueStack();
    const client = (yield* stateClient(url, authToken)).state;

    yield* client.setState({
      payload: {
        stack: stackA,
        stage: "e",
        fqn: "only-in-a",
        value: makeResource("only-in-a"),
      },
    });

    const listA = yield* client.listResources({
      payload: { stack: stackA, stage: "e" },
    });
    const listB = yield* client.listResources({
      payload: { stack: stackB, stage: "e" },
    });
    expect(listA).toEqual(["only-in-a"]);
    expect(listB).toEqual([]);

    const getFromB = yield* client.getState({
      payload: { stack: stackB, stage: "e", fqn: "only-in-a" },
    });
    expect(getFromB).toBeNull();
  }),
);

test(
  "missing required params on set returns 400",
  Effect.gen(function* () {
    const { url, authToken } = yield* stack;
    // Bypass the typed client to send a malformed payload.
    const res = yield* Effect.promise(() =>
      fetch(`${url}/state/set`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stack: uniqueStack(),
          stage: "e",
          // fqn missing
          value: makeResource("x"),
        }),
      }),
    );
    expect(res.status).toBe(400);
  }),
);

test(
  "FQNs containing slashes survive a set/get round-trip",
  Effect.gen(function* () {
    const { url, authToken } = yield* stack;
    const stackName = uniqueStack();
    const fqn = "Parent/Child/Grandchild";
    const client = (yield* stateClient(url, authToken)).state;

    yield* client.setState({
      payload: {
        stack: stackName,
        stage: "e",
        fqn,
        value: makeResource("Grandchild", { fqn }),
      },
    });

    const got = (yield* client.getState({
      payload: { stack: stackName, stage: "e", fqn },
    })) as ResourceState;
    expect(got.fqn).toBe(fqn);

    const listed = yield* client.listResources({
      payload: { stack: stackName, stage: "e" },
    });
    expect(listed).toEqual([fqn]);
  }),
);

test(
  "Redacted values survive a set/get round-trip via the HttpStateStore client",
  Effect.gen(function* () {
    const { url, authToken } = yield* stack;
    const stackName = uniqueStack();
    const secretValue = "super-secret-value-42";
    const client = (yield* stateClient(url, authToken)).state;

    // The state-store wire is opaque to Redacted; HttpStateStore (the
    // user-facing layer) would normally encode/decode the
    // `__redacted__` envelope. Here we drive the raw schema client,
    // so we send the envelope shape directly and assert it
    // round-trips byte-for-byte.
    const props = {
      apiKey: { __redacted__: secretValue },
      nested: {
        deeplyRedacted: { __redacted__: "nested-secret" },
      },
    };
    yield* client.setState({
      payload: {
        stack: stackName,
        stage: "e",
        fqn: "has-secret",
        value: makeResource("has-secret", { props: props as any }),
      },
    });

    const got = (yield* client.getState({
      payload: { stack: stackName, stage: "e", fqn: "has-secret" },
    })) as ResourceState;
    const gotProps = (got as any).props;
    expect(gotProps.apiKey.__redacted__).toBe(secretValue);
    expect(gotProps.nested.deeplyRedacted.__redacted__).toBe("nested-secret");

    // Sanity: the raw envelope is what HttpStateStore turns back into
    // a Redacted<string> via `reviveState`.
    const revived = Redacted.make(gotProps.apiKey.__redacted__);
    expect(Redacted.value(revived)).toBe(secretValue);
  }),
);
