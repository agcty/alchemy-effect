import * as Cloudflare from "alchemy/Cloudflare";
import type { ResourceState } from "alchemy/State";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { HttpServerRequest } from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import StateStore from "./StateStore.ts";
import { AuthToken } from "./Token.ts";

class Unauthorized {
  readonly _tag = "Unauthorized";
}

class BadRequest {
  readonly _tag = "BadRequest";
  constructor(readonly message: string) {}
}

/**
 * RPC method names the worker exposes over HTTP. Each maps 1:1 to a
 * method on `StateService` in `alchemy/src/State/State.ts`.
 */
const RPC_METHODS = [
  "listStacks",
  "listStages",
  "list",
  "get",
  "set",
  "delete",
  "getReplacedResources",
] as const;

type RpcMethod = (typeof RPC_METHODS)[number];

const isRpcMethod = (value: string): value is RpcMethod =>
  (RPC_METHODS as readonly string[]).includes(value);

/**
 * Timing-safe string comparison using the Workers runtime's built-in
 * `crypto.subtle.timingSafeEqual`.
 *
 * @see https://developers.cloudflare.com/workers/examples/protect-against-timing-attacks/
 */
const timingSafeEqual = (a: string, b: string): boolean => {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.byteLength !== bBytes.byteLength) return false;
  return crypto.subtle.timingSafeEqual(aBytes, bBytes);
};

const errorResponse = (
  code: string,
  message: string,
  status: number,
): Effect.Effect<HttpServerResponse.HttpServerResponse, never, never> =>
  HttpServerResponse.json(
    { ok: false, error: { code, message } },
    { status },
  ).pipe(Effect.orDie);

const okResponse = (
  result: unknown,
): Effect.Effect<HttpServerResponse.HttpServerResponse, never, never> =>
  HttpServerResponse.json({ ok: true, result: result ?? null }).pipe(
    Effect.orDie,
  );

const requireString = (
  body: Record<string, unknown>,
  field: string,
): Effect.Effect<string, BadRequest> => {
  const value = body[field];
  return typeof value === "string" && value.length > 0
    ? Effect.succeed(value)
    : Effect.fail(
        new BadRequest(
          `field '${field}' is required and must be a non-empty string`,
        ),
      );
};

const requireObject = (
  body: Record<string, unknown>,
  field: string,
): Effect.Effect<ResourceState, BadRequest> => {
  const value = body[field];
  return value && typeof value === "object" && !Array.isArray(value)
    ? Effect.succeed(value as ResourceState)
    : Effect.fail(
        new BadRequest(`field '${field}' is required and must be an object`),
      );
};

export default class Api extends Cloudflare.Worker<Api>()(
  "Api",
  {
    main: import.meta.path,
    url: true,
    compatibility: {
      flags: ["nodejs_compat"],
      date: "2026-03-17",
    },
  },
  Effect.gen(function* () {
    const secret = yield* Cloudflare.Secret.bind(AuthToken);
    const stateStore = yield* StateStore;

    // Module-scoped cache of the bearer token. The secret value is
    // immutable for the lifetime of a worker isolate (it only changes
    // when `Random` is replaced), so the Secrets Store API only needs
    // to be hit once per isolate boot.
    let cachedToken: string | undefined;

    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest;
        const url = new URL(request.url, "http://localhost");
        const path = url.pathname;
        const method = request.method;

        return yield* Effect.gen(function* () {
          // --- auth ---
          const authHeader = request.headers.authorization ?? "";
          const prefix = "Bearer ";
          if (!authHeader.startsWith(prefix)) {
            return yield* Effect.fail(new Unauthorized());
          }
          const presented = authHeader.slice(prefix.length).trim();
          if (cachedToken === undefined) {
            cachedToken = yield* secret.get().pipe(
              Effect.catchTag("SecretError", () =>
                Effect.fail(new Unauthorized()),
              ),
            );
          }
          if (!cachedToken || !timingSafeEqual(presented, cachedToken)) {
            return yield* Effect.fail(new Unauthorized());
          }

          // --- route: POST /projects/:project/state/:method ---
          const match = path.match(
            /^\/projects\/([^/]+)\/state\/([^/]+)\/?$/,
          );
          if (!match || method !== "POST") {
            return yield* errorResponse(
              "not_found",
              `${method} ${path}`,
              404,
            );
          }
          const project = decodeURIComponent(match[1]!);
          const rpc = match[2]!;
          if (!isRpcMethod(rpc)) {
            return yield* Effect.fail(
              new BadRequest(`unknown method: ${rpc}`),
            );
          }

          // --- parse body ---
          const text = yield* request.text.pipe(Effect.orDie);
          let body: Record<string, unknown>;
          try {
            body = text ? JSON.parse(text) : {};
          } catch {
            return yield* Effect.fail(new BadRequest("invalid JSON body"));
          }
          if (body === null || typeof body !== "object" || Array.isArray(body)) {
            return yield* Effect.fail(
              new BadRequest("expected JSON object body"),
            );
          }

          // --- dispatch ---
          const stub = stateStore.getByName(project);

          switch (rpc) {
            case "listStacks": {
              const result = yield* stub.listStacks().pipe(Effect.orDie);
              return yield* okResponse(result);
            }
            case "listStages": {
              const stack = yield* requireString(body, "stack");
              const result = yield* stub
                .listStages({ stack })
                .pipe(Effect.orDie);
              return yield* okResponse(result);
            }
            case "list": {
              const stack = yield* requireString(body, "stack");
              const stage = yield* requireString(body, "stage");
              const result = yield* stub
                .list({ stack, stage })
                .pipe(Effect.orDie);
              return yield* okResponse(result);
            }
            case "get": {
              const stack = yield* requireString(body, "stack");
              const stage = yield* requireString(body, "stage");
              const fqn = yield* requireString(body, "fqn");
              const result = yield* stub
                .get({ stack, stage, fqn })
                .pipe(Effect.orDie);
              return yield* okResponse(result);
            }
            case "set": {
              const stack = yield* requireString(body, "stack");
              const stage = yield* requireString(body, "stage");
              const fqn = yield* requireString(body, "fqn");
              const value = yield* requireObject(body, "value");
              const result = yield* stub
                .set({ stack, stage, fqn, value })
                .pipe(Effect.orDie);
              return yield* okResponse(result);
            }
            case "delete": {
              const stack = yield* requireString(body, "stack");
              const stage = yield* requireString(body, "stage");
              const fqn = yield* requireString(body, "fqn");
              // The DO method is `remove`, not `delete` — `delete` is
              // reserved by Cloudflare's RPC stub proxy.
              yield* stub
                .remove({ stack, stage, fqn })
                .pipe(Effect.orDie);
              return yield* okResponse(null);
            }
            case "getReplacedResources": {
              const stack = yield* requireString(body, "stack");
              const stage = yield* requireString(body, "stage");
              const result = yield* stub
                .getReplacedResources({ stack, stage })
                .pipe(Effect.orDie);
              return yield* okResponse(result);
            }
          }
        }).pipe(
          Effect.catchTag("Unauthorized", () =>
            errorResponse("unauthorized", "invalid bearer token", 401),
          ),
          Effect.catchTag("BadRequest", (e) =>
            errorResponse("bad_request", e.message, 400),
          ),
        );
      }).pipe(
        // Catch both errors and defects — any DO call that fails via
        // `Effect.orDie` surfaces as a defect, and without this it
        // would bubble up as Cloudflare's default plain-text 500.
        Effect.catchCause((cause) =>
          errorResponse("internal", String(cause), 500),
        ),
      ),
    };
  }).pipe(Effect.provide(Layer.mergeAll(Cloudflare.SecretBindingLive))),
) {}
