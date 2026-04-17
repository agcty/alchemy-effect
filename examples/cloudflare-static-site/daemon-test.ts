import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import * as DotAlchemy from "../../packages/alchemy/src/Config.ts";
import {
  Daemon,
  DaemonLive,
} from "../../packages/alchemy/src/Daemon/Client.ts";

const program = Effect.gen(function* () {
  const daemon = yield* Daemon;
  yield* daemon.spawn({
    id: "test",
    command: "bun",
    args: ["vite", "dev"],
    options: {
      stdout: "inherit",
      stderr: "inherit",
    },
  });
  console.log("daemon exited");
}).pipe(
  Effect.provide(DaemonLive),
  Effect.provide(DotAlchemy.dotAlchemy),
  Effect.provide(NodeServices.layer),
);

await Effect.runPromise(program);
