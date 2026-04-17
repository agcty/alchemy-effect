import { Scope } from "effect";
import * as Effect from "effect/Effect";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as ChildProcess from "effect/unstable/process/ChildProcess";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";
import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import * as RpcSchema from "effect/unstable/rpc/RpcSchema";
import { ProcessAlreadyExistsError, ProcessNotFoundError } from "./Error.ts";
import * as Monitor from "./Monitor.ts";
import * as platform from "./Platform.ts";

export interface DaemonSpawnRequest {
  readonly id: string;
  readonly command: string;
  readonly args?: ReadonlyArray<string>;
  readonly options: Schema.Schema.Type<typeof platform.CommandOptions>;
  readonly override?:
    | boolean
    | Schema.Schema.Type<typeof platform.KillOptions>;
}

export interface DaemonKillRequest {
  readonly id: string;
  readonly options?: Schema.Schema.Type<typeof platform.KillOptions>;
}

export interface DaemonWatchRequest {
  readonly id: string;
  readonly fd: Schema.Schema.Type<typeof platform.Fd>;
}

export interface DaemonProcessManager {
  readonly heartbeat: () => Effect.Effect<void>;
  readonly spawn: (
    input: DaemonSpawnRequest,
  ) => Effect.Effect<
    void,
    Schema.Schema.Type<typeof platform.PlatformError> | ProcessAlreadyExistsError
  >;
  readonly kill: (
    input: DaemonKillRequest,
  ) => Effect.Effect<
    void,
    Schema.Schema.Type<typeof platform.PlatformError> | ProcessNotFoundError
  >;
  readonly watch: (
    input: DaemonWatchRequest,
  ) => Effect.Effect<
    Stream.Stream<Uint8Array, Schema.Schema.Type<typeof platform.PlatformError>>,
    ProcessNotFoundError
  >;
  readonly exit: () => Effect.Effect<
    void,
    Schema.Schema.Type<typeof platform.PlatformError>
  >;
}

export const DaemonRpcs = RpcGroup.make(
  Rpc.make("heartbeat", {
    success: Schema.Void,
  }),
  Rpc.make("spawn", {
    payload: {
      id: Schema.String,
      command: Schema.String,
      args: Schema.optional(Schema.Array(Schema.String)),
      options: platform.CommandOptions,
      override: Schema.optional(
        Schema.Union([Schema.Boolean, platform.KillOptions]),
      ),
    },
    error: Schema.Union([platform.PlatformError, ProcessAlreadyExistsError]),
  }),
  Rpc.make("kill", {
    payload: {
      id: Schema.String,
      options: Schema.optional(platform.KillOptions),
    },
    error: Schema.Union([platform.PlatformError, ProcessNotFoundError]),
  }),
  Rpc.make("watch", {
    payload: {
      id: Schema.String,
      fd: platform.Fd,
    },
    success: RpcSchema.Stream(Schema.Uint8Array, platform.PlatformError),
    error: ProcessNotFoundError,
  }),
  Rpc.make("exit", {
    success: Schema.Void,
    error: platform.PlatformError,
  }),
);

export const DaemonHandlers = DaemonRpcs.toLayer(
  Effect.gen(function* () {
    const monitor = yield* Monitor.Monitor;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const processes = MutableHashMap.empty<
      string,
      ChildProcessSpawner.ChildProcessHandle
    >();
    const scope = yield* Effect.scope;

    const getProcessOrFail = (id: string) => {
      const handle = MutableHashMap.get(processes, id);
      if (Option.isSome(handle)) {
        return Effect.succeed(handle.value);
      }
      return Effect.fail(
        new ProcessNotFoundError({
          message: `Process ${id} not found`,
          id,
        }),
      );
    };

    const killAll = () =>
      Effect.forEach(
        MutableHashMap.values(processes),
        (handle) => handle.kill({ killSignal: "SIGKILL" }),
        { concurrency: "unbounded" },
      );

    yield* Effect.addFinalizer(() => {
      console.log("[daemon handlers] adding finalizer");
      return killAll().pipe(Effect.ignore);
    });

    const handlers = {
      heartbeat: Effect.fnUntraced(function* () {
        yield* Effect.logInfo("Heartbeat received");
        yield* monitor.heartbeat;
      }),
      spawn: Effect.fnUntraced(function* (input) {
        yield* Effect.logInfo("Spawn request received", input);
        const existing = MutableHashMap.get(processes, input.id);
        if (Option.isSome(existing)) {
          if (input.override) {
            yield* existing.value
              .kill(input.override === true ? undefined : input.override)
              .pipe(Effect.orDie);
            MutableHashMap.remove(processes, input.id);
          } else {
            return yield* new ProcessAlreadyExistsError({
              message: `Process ${input.id} already exists`,
              id: input.id,
            });
          }
        }
        const command = ChildProcess.make(
          input.command,
          input.args ?? [],
          input.options,
        );
        const handle = yield* spawner.spawn(command).pipe(
          Scope.provide(scope),
          Effect.tapError((e) => Effect.logError("Error spawning process", e)),
        );
        MutableHashMap.set(processes, input.id, handle);
      }),
      kill: Effect.fnUntraced(function* ({ id, options }) {
        yield* Effect.logInfo("Kill request received");
        const handle = yield* getProcessOrFail(id);
        yield* handle.kill(options);
      }),
      watch: Effect.fnUntraced(function* ({ id, fd }) {
        yield* Effect.logInfo("Watch request received");
        const handle = yield* getProcessOrFail(id);
        switch (fd) {
          case "stdout":
            return handle.stdout;
          case "stderr":
            return handle.stderr;
          default:
            return handle.getOutputFd(fd[1]);
        }
      }, Stream.unwrap),
      exit: Effect.fnUntraced(function* () {
        console.log("[daemon handlers] exit request received");
        yield* killAll();
        yield* monitor.exit;
      }),
    };

    return handlers;
  }),
);
