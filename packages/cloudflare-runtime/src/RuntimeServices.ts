import * as Layer from "effect/Layer";
import * as Internet from "./Internet.ts";
import * as LocalProxy from "./proxy/LocalProxy.ts";
import * as RemoteBindings from "./remote-bindings/RemoteBindings.ts";
import * as Server from "./Server.ts";
import * as Storage from "./Storage.ts";
import * as Runtime from "./workerd/Runtime.ts";

export const layer = (config: {
  host?: string;
  port?: number;
  storage?: string;
  accountId: string;
}) =>
  Server.layer.pipe(
    Layer.provideMerge(
      LocalProxy.layerLive({ host: config.host ?? "localhost", port: config.port ?? 1337 }),
    ),
    Layer.provide(
      Layer.mergeAll(
        Runtime.layer,
        config.storage ? Storage.layerDisk(config.storage) : Storage.layerTemp(),
        Internet.layer,
        RemoteBindings.layerServices(config.accountId),
      ),
    ),
  );
