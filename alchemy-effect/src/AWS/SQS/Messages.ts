import * as sqs from "distilled-aws/sqs";
import * as Effect from "effect/Effect";
import { Runtime } from "../../Runtime.ts";
import * as Lambda from "../Lambda/index.ts";
import type { Queue } from "./Queue.ts";

export const messages = <Q extends Queue>(queue: Q) => {
  subscribe: Effect.fn(function* <Q extends Queue>(queue: Q) {
    const QueueUrl = yield* queue.queueUrl();

    const runtime = yield* Runtime;

    if (runtime.listen) {
      if (Lambda.isFunction(runtime)) {
        yield* Lambda.EventSourceMapping(`${queue.id}-EventSourceMapping`, {
          functionArn: yield* runtime.functionArn(),
          queue,
        });
      }
    }

    return Effect.fn(function* () {
      return yield* sqs.receiveMessage({
        QueueUrl: yield* QueueUrl,
      });
    });
  });
};
