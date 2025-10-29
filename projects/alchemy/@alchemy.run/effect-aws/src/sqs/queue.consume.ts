import { Binding, Capability, type From } from "@alchemy.run/effect";
import type * as lambda from "aws-lambda";
import * as Effect from "effect/Effect";
import { Function } from "../lambda/index.ts";
import { Queue } from "./queue.ts";

export type QueueRecord<Data> = Omit<lambda.SQSRecord, "body"> & {
  body: Data;
};

export type QueueEvent<Data> = Omit<lambda.SQSEvent, "Records"> & {
  Records: QueueRecord<Data>[];
};

export interface Consume<Q = Queue> extends Capability<"AWS.SQS.Consume", Q> {}

export const QueueEventSource = Binding<
  <Q extends Queue>(
    queue: Q,
    props?: {
      batchSize?: number;
      maxBatchingWindow?: number;
      maxConcurrency?: number;
      reportBatchItemFailures?: boolean;
    },
  ) => Binding<Function, Consume<From<Q>>>
>(Function, Queue, "AWS.SQS.Consume");

export const consumeFromLambdaFunction = () =>
  QueueEventSource.layer.succeed({
    // oxlint-disable-next-line require-yield
    attach: Effect.fn(function* (queue, _props, _target) {
      return {
        policyStatements: [
          {
            Sid: capability.sid,
            Effect: "Allow",
            Action: [
              "sqs:ReceiveMessage",
              "sqs:DeleteMessage",
              "sqs:ChangeMessageVisibility",
            ],
            Resource: [queue.attr.queueArn],
          },
        ],
      };
    }),
  });
