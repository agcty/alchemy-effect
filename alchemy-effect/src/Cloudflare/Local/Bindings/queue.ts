import type * as cf from "@cloudflare/workers-types";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import {
  Rpc,
  RpcClient,
  RpcGroup,
} from "effect/unstable/rpc";
import {
  makeWorkerRpcProtocol,
  runWorkerRpc,
} from "../http-rpc-client.ts";

// ---------------------------------------------------------------------------
// Schema: Channel C (HTTP RPC) -- sending messages
// ---------------------------------------------------------------------------

const queueSend = Rpc.make("queueSend", {
  payload: {
    queue: Schema.String,
    body: Schema.Unknown,
    contentType: Schema.optional(Schema.String),
    delaySeconds: Schema.optional(Schema.Number),
  },
  success: Schema.Void,
});

const queueSendBatch = Rpc.make("queueSendBatch", {
  payload: {
    queue: Schema.String,
    messages: Schema.Array(
      Schema.Struct({
        body: Schema.Unknown,
        contentType: Schema.optional(Schema.String),
        delaySeconds: Schema.optional(Schema.Number),
      }),
    ),
    delaySeconds: Schema.optional(Schema.Number),
  },
  success: Schema.Void,
});

export class QueueRpcs extends RpcGroup.make(queueSend, queueSendBatch) {}

// ---------------------------------------------------------------------------
// Server-side handlers (runs inside the proxy worker fetch handler)
// ---------------------------------------------------------------------------

export const makeQueueHandlers = (env: Record<string, any>) =>
  QueueRpcs.toLayer({
    queueSend: ({ queue: queueName, body, contentType, delaySeconds }) =>
      Effect.tryPromise(async () => {
        const q: cf.Queue = env[queueName];
        await q.send(body as any, {
          contentType: contentType as cf.QueueContentType | undefined,
          delaySeconds,
        });
      }),
    queueSendBatch: ({ queue: queueName, messages, delaySeconds }) =>
      Effect.tryPromise(async () => {
        const q: cf.Queue = env[queueName];
        await q.sendBatch(
          messages.map((m) => ({
            body: m.body as any,
            contentType: m.contentType as cf.QueueContentType | undefined,
            delaySeconds: m.delaySeconds,
          })),
          { delaySeconds },
        );
      }),
  });

// ---------------------------------------------------------------------------
// Client-side facade (runs locally) -- sending
// ---------------------------------------------------------------------------

type QueueRpcClient = RpcClient.RpcClient<RpcGroup.Rpcs<typeof QueueRpcs>, any>;

export interface QueueFacade<Body = unknown> {
  send(
    message: Body,
    options?: { contentType?: string; delaySeconds?: number },
  ): Promise<void>;
  sendBatch(
    messages: Array<{
      body: Body;
      contentType?: string;
      delaySeconds?: number;
    }>,
    options?: { delaySeconds?: number },
  ): Promise<void>;
}

export function makeQueueFacade<Body = unknown>(
  client: QueueRpcClient,
  queue: string,
): QueueFacade<Body> {
  return {
    async send(message, options) {
      await runWorkerRpc(
        client.queueSend({
          queue,
          body: message,
          contentType: options?.contentType,
          delaySeconds: options?.delaySeconds,
        }),
      );
    },
    async sendBatch(messages, options) {
      await runWorkerRpc(
        client.queueSendBatch({
          queue,
          messages: messages.map((m) => ({
            body: m.body,
            contentType: m.contentType,
            delaySeconds: m.delaySeconds,
          })),
          delaySeconds: options?.delaySeconds,
        }),
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Client-side consumer (runs locally) -- receiving
// ---------------------------------------------------------------------------

export interface QueueMessage<Body = unknown> {
  readonly id: string;
  readonly body: Body;
  readonly timestamp: Date;
  readonly attempts: number;
  ack(): Promise<void>;
  retry(options?: { delaySeconds?: number }): Promise<void>;
}

export interface QueueBatch<Body = unknown> {
  readonly queue: string;
  readonly messages: ReadonlyArray<QueueMessage<Body>>;
  ackAll(): Promise<void>;
  retryAll(options?: { delaySeconds?: number }): Promise<void>;
}

export interface QueueBatchDecision {
  readonly ackedIds: ReadonlyArray<string>;
  readonly retriedIds: ReadonlyArray<{
    readonly id: string;
    readonly delaySeconds?: number;
  }>;
  readonly ackAll: boolean;
  readonly retryAll: boolean;
  readonly retryAllDelay?: number;
}

export type QueueHandler<Body = unknown> = (
  batch: QueueBatch<Body>,
) => void | Promise<void>;

/**
 * Creates a `localQueueBatch` handler for LocalRpcs.toLayer.
 * The handler returns a batch decision instead of sending follow-up RPCs back
 * to the Durable Object, avoiding a re-entrant RPC deadlock.
 */
export const makeQueueConsumer = <Body = unknown>(
  handler: QueueHandler<Body>,
) => ({
  localQueueBatch: ({
    queue,
    messages,
  }: {
    queue: string;
    messages: ReadonlyArray<{
      readonly id: string;
      readonly body: unknown;
      readonly timestamp: string;
      readonly attempts: number;
    }>;
  }) =>
    Effect.promise(async () => {
      const decision: {
        ackedIds: string[];
        retriedIds: Array<{ id: string; delaySeconds?: number }>;
        ackAll: boolean;
        retryAll: boolean;
        retryAllDelay?: number;
      } = {
        ackedIds: [],
        retriedIds: [],
        ackAll: false,
        retryAll: false,
      };
      const batch: QueueBatch<Body> = {
        queue,
        messages: messages.map((m) => ({
          id: m.id,
          body: m.body as Body,
          timestamp: new Date(m.timestamp),
          attempts: m.attempts,
          ack: async () => {
            decision.ackedIds.push(m.id);
          },
          retry: async (opts?: { delaySeconds?: number }) => {
            decision.retriedIds.push({
              id: m.id,
              delaySeconds: opts?.delaySeconds,
            });
          },
        })),
        ackAll: async () => {
          decision.ackAll = true;
        },
        retryAll: async (opts?: { delaySeconds?: number }) => {
          decision.retryAll = true;
          decision.retryAllDelay = opts?.delaySeconds;
        },
      };
      await handler(batch);
      return decision satisfies QueueBatchDecision;
    }),
});

// ---------------------------------------------------------------------------
// HTTP RPC client factory (for sending)
// ---------------------------------------------------------------------------

export const makeQueueClient = (workerUrl: string) =>
  Effect.gen(function* () {
    const protocol = yield* makeWorkerRpcProtocol(workerUrl);
    const client = yield* RpcClient.make(QueueRpcs).pipe(
      Effect.provideService(RpcClient.Protocol, protocol),
    );
    return {
      queue: <Body = unknown>(queueName: string) =>
        makeQueueFacade<Body>(client, queueName),
    };
  });
