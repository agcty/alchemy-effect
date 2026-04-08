import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";

const rpcRetrySchedule = Schedule.exponential("200 millis").pipe(
  Schedule.take(5),
);

const isRetryableRpcClientError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  error._tag === "RpcClientError";

export const runWorkerRpc = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(
    effect.pipe(
      Effect.retry({
        while: isRetryableRpcClientError,
        schedule: rpcRetrySchedule,
      }),
    ),
  );

export const makeWorkerRpcProtocol = (workerUrl: string) =>
  Effect.gen(function* () {
    const baseClient = yield* HttpClient.HttpClient;
    const rpcClient = HttpClient.mapRequest(
      baseClient,
      HttpClientRequest.prependUrl(`${workerUrl}/rpc`),
    );
    return yield* RpcClient.makeProtocolHttp(rpcClient).pipe(
      Effect.provide(RpcSerialization.layerJson),
    );
  });
