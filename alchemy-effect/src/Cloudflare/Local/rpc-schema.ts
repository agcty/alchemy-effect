import * as Schema from "effect/Schema";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

// ---------------------------------------------------------------------------
// RPCs served by the REMOTE proxy worker (called by local via WebSocket)
// ---------------------------------------------------------------------------

const remotePing = Rpc.make("remotePing", {
  success: Schema.Struct({ ts: Schema.Number }),
});

const remoteEcho = Rpc.make("remoteEcho", {
  payload: { message: Schema.String },
  success: Schema.Struct({ message: Schema.String }),
});

export class RemoteRpcs extends RpcGroup.make(remotePing, remoteEcho) {}

// ---------------------------------------------------------------------------
// RPCs served by the LOCAL client (called by remote via WebSocket)
// ---------------------------------------------------------------------------

const localPing = Rpc.make("localPing", {
  success: Schema.Struct({ ts: Schema.Number }),
});

const localEcho = Rpc.make("localEcho", {
  payload: { message: Schema.String },
  success: Schema.Struct({ message: Schema.String }),
});

const QueueMessageSchema = Schema.Struct({
  id: Schema.String,
  body: Schema.Unknown,
  timestamp: Schema.String,
  attempts: Schema.Number,
});

const QueueBatchDecisionSchema = Schema.Struct({
  ackedIds: Schema.Array(Schema.String),
  retriedIds: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      delaySeconds: Schema.optional(Schema.Number),
    }),
  ),
  ackAll: Schema.Boolean,
  retryAll: Schema.Boolean,
  retryAllDelay: Schema.optional(Schema.Number),
});

const localQueueBatch = Rpc.make("localQueueBatch", {
  payload: {
    queue: Schema.String,
    messages: Schema.Array(QueueMessageSchema),
  },
  success: QueueBatchDecisionSchema,
});

export class LocalRpcs extends RpcGroup.make(
  localPing,
  localEcho,
  localQueueBatch,
) {}
