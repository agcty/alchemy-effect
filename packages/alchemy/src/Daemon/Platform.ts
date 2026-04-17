import {
  BadArgument,
  PlatformError as EffectPlatformError,
  SystemError,
} from "effect/PlatformError";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as RpcSchema from "effect/unstable/rpc/RpcSchema";

export class RpcSystemError extends Schema.ErrorClass<RpcSystemError>(
  "RpcSystemError",
)({
  _tag: Schema.Literals([
    "AlreadyExists",
    "BadResource",
    "Busy",
    "InvalidData",
    "NotFound",
    "PermissionDenied",
    "TimedOut",
    "UnexpectedEof",
    "Unknown",
    "WouldBlock",
    "WriteZero",
  ]),
  module: Schema.String,
  method: Schema.String,
  description: Schema.optional(Schema.String),
  syscall: Schema.optional(Schema.String),
  pathOrDescriptor: Schema.optional(
    Schema.Union([Schema.String, Schema.Number]),
  ),
  cause: Schema.optional(Schema.DefectWithStack),
}) {}

export class RpcBadArgumentError extends Schema.TaggedErrorClass<RpcBadArgumentError>()(
  "BadArgument",
  {
    module: Schema.String,
    method: Schema.String,
    description: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.DefectWithStack),
  },
) {}

export const PlatformError = Schema.instanceOf(EffectPlatformError).pipe(
  Schema.encodeTo(
    Schema.Struct({
      reason: Schema.Union([RpcSystemError, RpcBadArgumentError]),
    }),
    {
      encode: SchemaGetter.transform((error) => {
        if (error.reason._tag === "BadArgument") {
          return { reason: new RpcBadArgumentError(error.reason) };
        }
        return { reason: new RpcSystemError(error.reason) };
      }),
      decode: SchemaGetter.transform((error) => {
        if (error.reason._tag === "BadArgument") {
          return new EffectPlatformError(new BadArgument(error.reason));
        }
        return new EffectPlatformError(new SystemError(error.reason));
      }),
    },
  ),
);

export const Signal = Schema.Literals([
  "SIGABRT",
  "SIGALRM",
  "SIGBUS",
  "SIGCHLD",
  "SIGCONT",
  "SIGFPE",
  "SIGHUP",
  "SIGILL",
  "SIGINT",
  "SIGIO",
  "SIGIOT",
  "SIGKILL",
  "SIGPIPE",
  "SIGPOLL",
  "SIGPROF",
  "SIGPWR",
  "SIGQUIT",
  "SIGSEGV",
  "SIGSTKFLT",
  "SIGSTOP",
  "SIGSYS",
  "SIGTERM",
  "SIGTRAP",
  "SIGTSTP",
  "SIGTTIN",
  "SIGTTOU",
  "SIGUNUSED",
  "SIGURG",
  "SIGUSR1",
  "SIGUSR2",
  "SIGVTALRM",
  "SIGWINCH",
  "SIGXCPU",
  "SIGXFSZ",
  "SIGBREAK",
  "SIGLOST",
  "SIGINFO",
]);

export const KillOptions = Schema.Struct({
  killSignal: Schema.optional(Signal),
  forceKillAfter: Schema.optional(Schema.Duration),
});

const CommandInput = Schema.Union([
  Schema.Literals(["pipe", "inherit", "ignore", "overlapped"]),
  RpcSchema.Stream(Schema.Uint8Array, PlatformError),
]);

const CommandOutput = Schema.Literals([
  "pipe",
  "inherit",
  "ignore",
  "overlapped",
]);

export const AdditionalFd = Schema.TemplateLiteral([
  Schema.Literal("fd"),
  Schema.Int,
]);
export const Fd = Schema.Union([
  Schema.Tuple([Schema.Literal("fd"), Schema.Int]),
  Schema.Literals(["stdout", "stderr"]),
]);

export const CommandOptions = Schema.Struct({
  cwd: Schema.optional(Schema.String),
  env: Schema.optional(
    Schema.Record(Schema.String, Schema.UndefinedOr(Schema.String)),
  ),
  extendEnv: Schema.optional(Schema.Boolean),
  shell: Schema.optional(Schema.Union([Schema.Boolean, Schema.String])),
  detached: Schema.optional(Schema.Boolean),
  stdin: Schema.optional(CommandInput),
  stdout: Schema.optional(CommandOutput),
  stderr: Schema.optional(CommandOutput),
  additionalFds: Schema.optional(
    Schema.Record(
      AdditionalFd,
      Schema.Struct({
        type: Schema.Literals(["input", "output"]),
      }),
    ),
  ),
});
