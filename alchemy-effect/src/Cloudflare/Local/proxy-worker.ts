/**
 * Cloudflare Worker + Durable Object that acts as the remote side of the
 * bi-directional RPC bridge. This file is bundled with rolldown and deployed
 * via putScript.
 *
 * The worker routes incoming requests to a Session Durable Object which holds
 * a hibernatable WebSocket and runs Effect RPC over it.
 */

import type * as cf from "@cloudflare/workers-types";
import { DurableObject } from "cloudflare:workers";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import type { Scope } from "effect/Scope";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import { RpcClient, RpcSerialization, RpcServer } from "effect/unstable/rpc";
import {
  QueueRpcs,
  type QueueBatchDecision,
  makeQueueHandlers,
} from "./Bindings/queue.ts";
import { R2Rpcs, makeR2Handlers } from "./Bindings/r2.ts";
import {
  type HibernatableProtocols,
  makeHibernatableProtocols,
  routeMessage,
} from "./rpc-protocol.ts";
import { LocalRpcs, RemoteRpcs } from "./rpc-schema.ts";

function serveRpcRequest(
  webRequest: Request,
  handler: Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    any,
    HttpServerRequest.HttpServerRequest | Scope
  >,
) {
  return Effect.gen(function* () {
    const request = HttpServerRequest.fromWeb(webRequest);
    const response = yield* handler.pipe(
      Effect.provideService(HttpServerRequest.HttpServerRequest, request),
    );
    const services = yield* Effect.services();
    return HttpServerResponse.toWeb(response, { services });
  });
}

interface Env {
  SESSION: DurableObjectNamespace<Session>;
  [key: string]: unknown;
}

/** Payload for DO RPC must be structured-clone / RPC-serializable. */
function rpcSerializableBody(body: unknown): unknown {
  if (body === null) return null;
  const t = typeof body;
  if (t === "string" || t === "number" || t === "boolean") return body;
  if (body instanceof ArrayBuffer) {
    return Array.from(new Uint8Array(body));
  }
  if (ArrayBuffer.isView(body)) {
    const v = body as ArrayBufferView;
    return Array.from(
      new Uint8Array(v.buffer, v.byteOffset, v.byteLength),
    );
  }
  try {
    return JSON.parse(JSON.stringify(body)) as unknown;
  } catch {
    return String(body);
  }
}

function makeRpcHandler(env: Env) {
  const combined = R2Rpcs.merge(QueueRpcs);
  return RpcServer.toHttpEffect(combined).pipe(
    Effect.provide(makeR2Handlers(env)),
    Effect.provide(makeQueueHandlers(env)),
    Effect.provide(RpcSerialization.layerJson),
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/rpc" || url.pathname === "/rpc/") {
      return Effect.runPromise(
        makeRpcHandler(env).pipe(
          Effect.flatMap((handler) => serveRpcRequest(request, handler)),
          Effect.scoped,
        ),
      );
    }

    if (url.pathname === "/ws") {
      const id = env.SESSION.idFromName("default");
      const stub = env.SESSION.get(id);
      return stub.fetch(request);
    }

    if (url.pathname === "/health") {
      return new Response("ok");
    }

    if (url.pathname === "/test-call-local") {
      const id = env.SESSION.idFromName("default");
      const stub = env.SESSION.get(id);
      return stub.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },

  async queue(
    batch: cf.MessageBatch,
    env: Env,
    _ctx: cf.ExecutionContext,
  ): Promise<void> {
    const sessionId = env.SESSION.idFromName("default");
    const stub = env.SESSION.get(sessionId);
    console.log(
      `[worker.queue] received batch queue=${batch.queue} messages=${batch.messages.length} ids=${batch.messages.map((m) => m.id).join(",")}`,
    );
    const result = await stub.proxyQueueBatch({
      queue: batch.queue,
      messages: batch.messages.map((m) => ({
        id: m.id,
        body: rpcSerializableBody(m.body),
        timestamp: m.timestamp.toISOString(),
        attempts: m.attempts,
      })),
    });
    console.log(
      `[worker.queue] decision ackAll=${result.ackAll} retryAll=${result.retryAll} ackedIds=${result.ackedIds.join(",")} retriedIds=${result.retriedIds.map((r) => r.id).join(",")}`,
    );

    if (result.ackAll) {
      console.log("[worker.queue] ackAll()");
      batch.ackAll();
    } else if (result.retryAll) {
      console.log(
        `[worker.queue] retryAll(${String(result.retryAllDelay)})`,
      );
      batch.retryAll(
        result.retryAllDelay
          ? { delaySeconds: result.retryAllDelay }
          : undefined,
      );
    } else {
      const messageMap = new Map(batch.messages.map((m) => [m.id, m]));
      for (const id of result.ackedIds) {
        console.log(`[worker.queue] ack(${id})`);
        messageMap.get(id)?.ack();
      }
      for (const { id, delaySeconds } of result.retriedIds) {
        console.log(
          `[worker.queue] retry(${id}, delay=${String(delaySeconds)})`,
        );
        messageMap.get(id)?.retry(delaySeconds ? { delaySeconds } : undefined);
      }
    }
  },
};

// ---------------------------------------------------------------------------
// Session Durable Object
// ---------------------------------------------------------------------------

export interface ProxyQueueBatchInput {
  queue: string;
  messages: Array<{
    id: string;
    body: unknown;
    timestamp: string;
    attempts: number;
  }>;
}

export class Session extends DurableObject<Env> {
  private protocols: HibernatableProtocols | null = null;
  private fiber: Fiber.Fiber<any> | null = null;
  // biome-ignore lint: complex inferred type
  private localClient: any = null;
  private clientReady = Promise.withResolvers<void>();
  private static readonly SESSION_WAIT_TIMEOUT_MS = 5_000;
  private static readonly SESSION_WAIT_POLL_MS = 100;

  private async waitForActiveSession(reason: string): Promise<boolean> {
    const deadline = Date.now() + Session.SESSION_WAIT_TIMEOUT_MS;

    while (Date.now() < deadline) {
      if (this.localClient) {
        return true;
      }

      const websockets = this.ctx.getWebSockets();
      if (websockets.length > 0) {
        console.log(
          `[Session.waitForActiveSession] ${reason}: rehydrating from ${websockets.length} hibernated websocket(s)`,
        );
        await this.ensureRuntime(websockets[0]);
        if (this.localClient) {
          return true;
        }
      }

      if (this.fiber) {
        await Promise.race([
          this.clientReady.promise,
          new Promise<void>((resolve) =>
            setTimeout(resolve, Session.SESSION_WAIT_POLL_MS),
          ),
        ]);
        if (this.localClient) {
          return true;
        }
      } else {
        await new Promise((resolve) =>
          setTimeout(resolve, Session.SESSION_WAIT_POLL_MS),
        );
      }
    }

    console.warn(
      `[Session.waitForActiveSession] ${reason}: timed out waiting for active session`,
    );
    return this.localClient !== null;
  }

  /**
   * Queue consumer path: forward the batch to the local client over Effect RPC.
   *
   * IMPORTANT: This method MUST NOT await the RPC response. Durable Object RPC
   * methods hold the input gate, which prevents `webSocketMessage` from firing.
   * Since the response arrives via WebSocket, awaiting it here creates a
   * deadlock. Instead we fork the call (fire-and-forget) and ack all messages
   * immediately. The local handler still receives every message.
   */
  async proxyQueueBatch(body: ProxyQueueBatchInput): Promise<QueueBatchDecision> {
    console.log(
      `[Session.proxyQueueBatch] queue=${body.queue} msgs=${body.messages.length}`,
    );

    if (!(await this.waitForActiveSession("proxyQueueBatch"))) {
      console.error("[Session.proxyQueueBatch] no localClient after ensureRuntime");
      throw new Error("No active WebSocket session — CF will retry");
    }

    try {
      const fiber = Effect.runFork(
        this.localClient.localQueueBatch({
          queue: body.queue,
          messages: body.messages,
        }),
      );
      this.ctx.waitUntil(
        Effect.runPromise(Fiber.await(fiber)).catch((e) =>
          console.error("[Session.proxyQueueBatch] fiber error:", e),
        ),
      );
      console.log("[Session.proxyQueueBatch] forked localQueueBatch");
    } catch (err) {
      console.error("[Session.proxyQueueBatch] fork failed:", err);
    }

    return {
      ackAll: true,
      retryAll: false,
      ackedIds: [],
      retriedIds: [],
    };
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      this.ctx.acceptWebSocket(server);
      await this.ensureRuntime(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/test-call-local") {
      if (!(await this.waitForActiveSession("test-call-local"))) {
        return new Response("No active session", { status: 503 });
      }
      try {
        const pingResult = await Effect.runPromise(
          this.localClient.localPing(),
        );
        const echoResult = await Effect.runPromise(
          this.localClient.localEcho({ message: "hello from remote" }),
        );
        return new Response(
          JSON.stringify({ ping: pingResult, echo: echoResult }),
          { headers: { "content-type": "application/json" } },
        );
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  }

  private async ensureRuntime(ws: WebSocket) {
    if (this.protocols) return;

    // Already initializing from another concurrent call — wait for it.
    if (this.fiber) {
      await Promise.race([
        this.clientReady.promise,
        new Promise<void>((_, r) =>
          setTimeout(
            () => r(new Error("ensureRuntime join timeout")),
            Session.SESSION_WAIT_TIMEOUT_MS,
          ),
        ),
      ]).catch((e) => console.error("[Session.ensureRuntime] join failed:", e));
      return;
    }

    console.log("[Session.ensureRuntime] initializing runtime...");
    const self = this;

    const rpcProgram = Effect.gen(function* () {
      const protos = yield* makeHibernatableProtocols(ws);
      self.protocols = protos;

      yield* RpcServer.make(RemoteRpcs).pipe(
        Effect.provideService(RpcServer.Protocol, protos.serverProtocol),
        Effect.provide(
          RemoteRpcs.toLayer({
            remotePing: () => Effect.succeed({ ts: Date.now() }),
            remoteEcho: ({ message }) => Effect.succeed({ message }),
          }),
        ),
        Effect.forkScoped,
      );

      self.localClient = yield* RpcClient.make(LocalRpcs).pipe(
        Effect.provideService(RpcClient.Protocol, protos.clientProtocol),
      );

      console.log("[Session.ensureRuntime] runtime ready");
      self.clientReady.resolve();

      yield* Effect.never;
    }).pipe(Effect.scoped);

    this.fiber = Effect.runFork(rpcProgram);

    await Promise.race([
      this.clientReady.promise,
      new Promise<void>((_, r) =>
        setTimeout(
          () => r(new Error("ensureRuntime timeout")),
          Session.SESSION_WAIT_TIMEOUT_MS,
        ),
      ),
    ]).catch((e) => console.error("[Session.ensureRuntime] failed:", e));
  }

  private teardown() {
    if (this.fiber) {
      this.ctx.waitUntil(Effect.runPromise(Fiber.interrupt(this.fiber)));
      this.fiber = null;
    }
    this.protocols = null;
    this.localClient = null;
    this.clientReady = Promise.withResolvers<void>();
  }

  override async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const size = typeof message === "string" ? message.length : (message as ArrayBuffer).byteLength;
    console.log(`[Session.webSocketMessage] ${size} bytes`);
    await this.ensureRuntime(ws);
    routeMessage(this.protocols!, message);
  }

  override webSocketClose(
    ws: WebSocket,
    code: number,
    _reason: string,
    _wasClean: boolean,
  ): void {
    this.teardown();
    ws.close(code, "session closed");
  }

  override webSocketError(ws: WebSocket, _error: unknown): void {
    this.teardown();
    ws.close(1011, "unexpected error");
  }
}
