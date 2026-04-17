import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as DotAlchemy from "../src/Config.ts";
import * as DaemonServer from "../src/Daemon/Server.ts";

const program = DaemonServer.startServer.pipe(
  Effect.provide(DotAlchemy.dotAlchemy),
  Effect.provide(NodeServices.layer),
  Effect.scoped,
);

const exit = await Effect.runPromiseExit(program);
console.dir({ thing: "process-manager", exit }, { depth: null });
