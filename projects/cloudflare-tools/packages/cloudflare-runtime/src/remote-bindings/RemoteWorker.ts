import * as workers from "@distilled.cloud/cloudflare/workers";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as RemoteWorkerScript from "worker:./workers/remote.worker.ts";
import * as Access from "./Access.ts";
import type { RemoteWorkerConfig, RemoteWorkerResult } from "./RemoteWorkerConfig.shared.ts";

export class SessionError extends Schema.TaggedErrorClass<SessionError>()("SessionError", {
  message: Schema.String,
  cause: Schema.optional(Schema.DefectWithStack),
}) {}

export class RemoteWorker extends Context.Service<
  RemoteWorker,
  {
    readonly deploy: (
      options: RemoteWorkerConfig,
    ) => Effect.Effect<RemoteWorkerResult, SessionError | Access.AccessError>;
  }
>()("cloudflare-runtime/remote-bindings/RemoteWorker") {}

export const make = Effect.fn(function* (accountId: string) {
  const http = yield* HttpClient.HttpClient;
  const access = yield* Access.Access;

  const createSubdomainEdgePreviewSession = yield* workers.createSubdomainEdgePreviewSession;
  const getSubdomain = yield* workers.getSubdomain;
  const createScriptEdgePreview = yield* workers.createScriptEdgePreview;

  const AccountSubdomain = yield* Effect.cached(
    getSubdomain({ accountId }).pipe(
      Effect.mapError(
        (cause) =>
          new SessionError({
            message: `Failed to get workers.dev subdomain for account ${accountId}`,
            cause,
          }),
      ),
    ),
  );

  const createPreviewUploadToken = Effect.fn(function* () {
    const { token, exchangeUrl } = yield* createSubdomainEdgePreviewSession({
      accountId,
    }).pipe(
      Effect.mapError(
        (cause) =>
          new SessionError({
            message: `Failed to create subdomain edge preview session for account ${accountId}`,
            cause,
          }),
      ),
    );
    if (!exchangeUrl) {
      return token;
    }
    const json = yield* http.get(exchangeUrl).pipe(
      Effect.flatMap((response) => response.json),
      Effect.timeout(30_000),
      Effect.catch(() => Effect.succeed(null)),
    );
    if (
      typeof json === "object" &&
      json !== null &&
      "token" in json &&
      typeof json.token === "string"
    ) {
      return json.token;
    }
    return token;
  });

  const uploadPreviewScript = Effect.fn(function* (
    options: RemoteWorkerConfig,
    cfPreviewUploadConfigToken: string,
  ) {
    const files = RemoteWorkerScript.modules.map(
      (module) =>
        new File([module.content], module.name, { type: "application/javascript+module" }),
    );
    return yield* createScriptEdgePreview({
      accountId,
      scriptName: options.name,
      cfPreviewUploadConfigToken,
      wranglerSessionConfig: { workersDev: true, minimalMode: true },
      metadata: {
        compatibilityDate: "2025-04-28",
        bindings: options.bindings,
        mainModule: files[0].name,
      },
      files,
    }).pipe(
      Effect.timeout(30_000),
      Effect.mapError(
        (cause) =>
          new SessionError({
            message: `Failed to create script edge preview for account ${accountId}`,
            cause,
          }),
      ),
    );
  });

  return RemoteWorker.of({
    deploy: Effect.fn(function* (options) {
      const [{ previewToken }, { url, headers }] = yield* Effect.all(
        [
          createPreviewUploadToken().pipe(
            Effect.flatMap((cfPreviewUploadConfigToken) =>
              uploadPreviewScript(options, cfPreviewUploadConfigToken),
            ),
          ),
          AccountSubdomain.pipe(
            Effect.map(({ subdomain }) => `${options.name}.${subdomain}.workers.dev`),
            Effect.flatMap(
              Effect.fn(function* (host) {
                const headers = yield* access.getAccessHeaders(host);
                return { url: `https://${host}`, headers };
              }),
            ),
          ),
        ],
        { concurrency: "unbounded" },
      );
      return {
        url,
        headers: { ...headers, "cf-workers-preview-token": previewToken },
      };
    }),
  });
});

export const layer = (accountId: string) => Layer.effect(RemoteWorker, make(accountId));
