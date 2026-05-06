import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Hash from "effect/Hash";
import * as Layer from "effect/Layer";
import * as HttpServer from "effect/unstable/http/HttpServer";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as ClientWorker from "worker:./workers/client.worker.ts";
import * as OutboundWorker from "worker:./workers/outbound.worker.ts";
import type { Plugin } from "../Plugin.ts";
import * as Config from "../workerd/Config.ts";
import * as WorkerModule from "../WorkerModule.ts";
import * as Access from "./Access.ts";
import * as RemoteWorker from "./RemoteWorker.ts";
import type {
  RemoteBinding,
  RemoteWorkerConfig,
  RemoteWorkerResult,
} from "./RemoteWorkerConfig.shared.ts";

export class RemoteBindings extends Context.Service<
  RemoteBindings,
  (bindings: Array<RemoteBinding>) => Plugin
>()("cloudflare-runtime/remote-bindings/RemoteBindings") {}

export type { RemoteBinding };

export const layer = Layer.effect(
  RemoteBindings,
  Effect.gen(function* () {
    const httpServer = yield* HttpServer.HttpServer;
    const remoteWorker = yield* RemoteWorker.RemoteWorker;
    const prefetches = new Map<
      number,
      Fiber.Fiber<RemoteWorkerResult, RemoteWorker.SessionError | Access.AccessError>
    >();
    yield* httpServer.serve(
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const json = (yield* request.json) as unknown as RemoteWorkerConfig;
        const hash = Hash.structure(json);
        const prefetched = prefetches.get(hash);
        if (prefetched) {
          prefetches.delete(hash);
        }
        const deploy = prefetched ? Fiber.join(prefetched) : remoteWorker.deploy(json);
        const result = yield* deploy.pipe(
          Effect.map((result) => ({ success: true, result })),
          Effect.catchCause((cause) =>
            Effect.succeed({ success: false, error: { message: Cause.pretty(cause) } }),
          ),
        );
        return yield* HttpServerResponse.json(result, { status: result.success ? 200 : 500 });
      }),
    );
    const address = httpServer.address as HttpServer.TcpAddress;
    return RemoteBindings.of((bindings) => ({
      name: "remote-bindings",
      make: Effect.fnUntraced(function* (worker) {
        if (bindings.length === 0) return {};
        const config: RemoteWorkerConfig = {
          name: worker.name,
          bindings,
        };
        const loopback = {
          name: "remote-bindings:loopback",
          external: {
            address: `${address.hostname}:${address.port}`,
            http: {},
          },
        } satisfies Config.Service;
        const outbound = {
          name: "remote-bindings:outbound",
          worker: {
            compatibilityDate: "2026-03-10",
            modules: OutboundWorker.modules.map(WorkerModule.toWorkerd),
            bindings: [
              {
                name: "PROXY",
                durableObjectNamespace: { className: "RemoteBindingProxy" },
              },
              {
                name: "LOOPBACK",
                service: { name: loopback.name },
              },
              {
                name: "OPTIONS",
                json: JSON.stringify(config),
              },
            ],
            durableObjectNamespaces: [
              {
                className: "RemoteBindingProxy",
                enableSql: true,
                preventEviction: true,
                ephemeralLocal: Config.kVoid,
              },
            ],
          },
        } satisfies Config.Service;
        const client = {
          name: "remote-bindings:client",
          worker: {
            compatibilityDate: "2026-03-10",
            modules: ClientWorker.modules.map(WorkerModule.toWorkerd),
            globalOutbound: { name: outbound.name },
          },
        } satisfies Config.Service;
        const fiber = yield* Effect.forkDetach(remoteWorker.deploy(config));
        prefetches.set(Hash.structure(config), fiber);
        return { services: [client, outbound, loopback] };
      }),
    }));
  }),
);

export const layerServices = (accountId: string) =>
  Layer.provide(layer, Layer.provide(RemoteWorker.layer(accountId), Access.layer));

/**
 * Returns a service designator for the specified remote binding.
 */
export function makeServiceDesignator(binding: string): Config.ServiceDesignator {
  return {
    name: "remote-bindings:client",
    props: {
      json: JSON.stringify({ binding }),
    },
  };
}
