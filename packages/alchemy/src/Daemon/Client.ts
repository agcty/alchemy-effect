import * as NodeSocket from "@effect/platform-node/NodeSocket";
import { Schedule } from "effect";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/unstable/process/ChildProcess";
import * as RpcClient from "effect/unstable/rpc/RpcClient";
import type { RpcClientError } from "effect/unstable/rpc/RpcClientError";
import type * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization";
import { DaemonRpcs } from "./Handlers.ts";
import { DaemonSocketPath } from "./Server.ts";

type InferRpcClient<Group extends RpcGroup.RpcGroup<any>> =
  Group extends RpcGroup.RpcGroup<infer Rpcs>
    ? RpcClient.RpcClient<Rpcs, RpcClientError>
    : never;

export class Daemon extends Context.Service<
  Daemon,
  InferRpcClient<typeof DaemonRpcs>
>()("alchemy/Cli/Daemon") {}

export const make = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const socketPath = yield* DaemonSocketPath;
  const exists = fs.exists(socketPath);

  function startDaemon() {
    const bin = path.resolve(
      import.meta.dirname,
      "../../bin/process-manager.ts",
    );
    console.log(`Starting daemon from ${bin}…`);
    return ChildProcess.make("bun", ["run", bin], {
      stdout: "inherit",
      stderr: "inherit",
    });
  }

  if (!(yield* exists)) {
    yield* Effect.logInfo("Socket does not exist, starting daemon…");
    yield* startDaemon();
  } else {
    yield* Effect.logInfo("Socket exists, connecting to daemon…");
  }

  function waitForSocket() {
    return fs.exists(socketPath).pipe(
      Effect.flatMap((exists) =>
        exists ? Effect.void : Effect.fail({ _tag: "NotReady" } as const),
      ),
      Effect.retry(
        Schedule.spaced("100 millis").pipe(Schedule.both(Schedule.recurs(50))),
      ),
    );
  }

  console.log("[daemon client] waiting for socket");
  yield* waitForSocket();
  console.log("[daemon client] socket ready");

  // for (let i = 0; i < 10; i++) {
  //   const check = yield* exists;
  //   yield* Effect.logInfo(
  //     `Checking for socket… ${i} (${check ? "exists" : "not exists"})`,
  //   );
  //   if (check) {
  //     break;
  //   }
  //   yield* Effect.sleep("100 millis");
  // }

  console.log("[daemon client] making protocol socket");
  const protocol = yield* RpcClient.makeProtocolSocket().pipe(
    Effect.provide(NodeSocket.layerNet({ path: socketPath })),
    Effect.provide(RpcSerialization.layerJson),
    Effect.tapError((e) =>
      Effect.logError("Error creating protocol socket", e),
    ),
  );
  console.log("[daemon client] protocol made");
  const client = yield* RpcClient.make(DaemonRpcs).pipe(
    Effect.provideService(RpcClient.Protocol, protocol),
  );
  console.log("[daemon client] client made");

  process.on("SIGINT", async () => {
    console.log("SIGINT received");
    await Effect.runPromiseExit(client.exit());
    console.log("Exiting");
  });

  function sendHeartbeat() {
    return Effect.gen(function* () {
      yield* Effect.logInfo("Sending heartbeat");
      yield* client.heartbeat();
      yield* Effect.logInfo("Heartbeat sent");
    }).pipe(
      Effect.tapError((e) => Effect.logError("Error sending heartbeat", e)),
    );
  }

  yield* sendHeartbeat().pipe(
    Effect.repeat(Schedule.spaced("1 second")),
    Effect.forkScoped,
  );

  return client;
});

export const DaemonLive = Layer.effect(Daemon, make);
