import * as NodeSocketServer from "@effect/platform-node/NodeSocketServer";
import { Fiber } from "effect";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization";
import * as RpcServer from "effect/unstable/rpc/RpcServer";
import { DotAlchemy } from "../Config.ts";
import { DaemonHandlers, DaemonRpcs } from "./Handlers.ts";
import * as Monitor from "./Monitor.ts";

export const DaemonSocketPath = Effect.gen(function* () {
  const path = yield* Path.Path;
  const dir = yield* DotAlchemy;
  return path.join(dir, "daemon.sock");
});

export const startServer = Effect.gen(function* () {
  const shutdown = yield* Deferred.make<void>();
  const fs = yield* FileSystem.FileSystem;
  const socketPath = yield* DaemonSocketPath;
  const monitor = yield* Monitor.make(shutdown);
  console.log("[daemon server] starting daemon server on", socketPath);
  const layers = RpcServer.layer(DaemonRpcs).pipe(
    Layer.provide(RpcServer.layerProtocolSocketServer),
    Layer.provide(RpcSerialization.layerJson),
    Layer.provide(NodeSocketServer.layer({ path: socketPath })),
    Layer.provide(DaemonHandlers),
    Layer.provide(Layer.succeed(Monitor.Monitor, monitor)),
  );
  yield* Effect.addFinalizer(() =>
    Effect.gen(function* () {
      console.log("[daemon server] running finalizer");
      yield* fs.remove(socketPath, { force: true }).pipe(Effect.ignore);
    }),
  );
  console.log("[daemon server] launching layers");
  const fiber = yield* Layer.launch(layers).pipe(
    Effect.tapError((e) => Effect.logError("Error launching daemon server", e)),
    Effect.forkChild,
  );
  console.log("[daemon server] daemon server launched");
  yield* Deferred.await(shutdown);
  console.log("[daemon server] shutdown signal received");
  yield* Fiber.interrupt(fiber);
  console.log("[daemon server] daemon server shutdown");
});
