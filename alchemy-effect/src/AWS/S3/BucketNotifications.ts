import type lambda from "aws-lambda";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Stream from "effect/Stream";

import * as Binding from "../../Binding.ts";
import { Runtime } from "../../Runtime.ts";
import * as Lambda from "../Lambda/index.ts";
import * as SQS from "../SQS/index.ts";
import type { Bucket } from "./Bucket.ts";
import { BucketEventSource } from "./BucketEventSource.ts";
import type { S3EventType } from "./S3Event.ts";

export type S3Event = lambda.S3Event;
export type S3EventRecord = {
  type: S3EventType;
  bucket: string;
  key: string;
  size: number;
  eTag: string;
};

export const isS3Event = (event: any): event is S3Event =>
  Array.isArray(event.Records) &&
  event.Records.some((record: any) => record.s3);

export interface NotificationsProps<Events extends S3EventType[]> {
  events?: Events;
}

export const notifications = <
  B extends Bucket,
  const Events extends S3EventType[] = S3EventType[],
>(
  bucket: B,
  props: NotificationsProps<Events>,
) => ({
  subscribe: Effect.fn(function* <Err = never, Req = never>(
    process: (
      stream: Stream.Stream<S3EventRecord>,
    ) => Effect.Effect<void, Err, Req>,
  ) {
    // Bind the Bucket's bucketName Output to `this` environment
    const BucketName = yield* bucket.bucketName();

    const runtime = yield* Runtime;

    if (runtime.listen) {
      if (Lambda.isFunction(runtime)) {
        yield* BucketEventSource(`${bucket.id}-EventSource`, {
          functionArn: yield* runtime.functionArn(),
          bucket,
        });
      } else {
        return yield* Effect.die(
          `S3 Notifications are not supported in runtime '${runtime.type}'`,
        );
      }
      yield* runtime.listen(
        Effect.gen(function* () {
          const bucketName = yield* BucketName;
          return (event: any) => {
            if (isS3Event(event)) {
              const events = event.Records.filter(
                (record) => record.s3.bucket.name === bucketName,
              );
              if (events.length > 0) {
                return process(
                  Stream.fromArray(
                    events.map((record) => ({
                      type: record.eventName as S3EventType,
                      bucket: record.s3.bucket.name,
                      key: record.s3.object.key,
                      size: record.s3.object.size,
                      eTag: record.s3.object.eTag,
                    })),
                  ),
                ).pipe(Effect.orDie);
              }
            }
          };
        }),
      );
    } else {
      const queue = yield* SQS.Queue(`${bucket.id}-BucketEvents`);

      yield* BucketNotifications(bucket, { queue });

      return yield* SQS.messages(queue).subscribe(
        flow(
          Stream.mapEffect((message) =>
            Effect.try({
              try: () => JSON.parse(message.body) as S3Event,
              catch: (error) => Effect.die(error),
            }),
          ),
        ),
      );
    }
  }),
});

export interface BucketNotificationsProps<B extends Bucket> {
  bucket: B;
}

export const BucketNotifications = Binding.call<BucketNotificationsBinding>(
  "AWS.S3.BucketNotifications",
);

export class BucketNotificationsBinding extends Binding.fn(
  "AWS.S3.BucketNotifications",
  Effect.fn(function* <B extends Bucket, Q extends SQS.Queue>({
    bucket,
    queue,
  }: {
    bucket: B;
    queue: Q;
  }) {
    yield* Events.Rule("BucketEvents", {
      eventPattern: {
        source: ["aws.s3"],
        detail: {
          bucket: {
            name: [yield* bucket.bucketName()],
          },
        },
      },
      targets: [
        {
          Id: "SqsTarget",
          Arn: yield* queue.queueArn(),
          RoleArn: { "Fn::GetAtt": ["EventBridgeToSqsRole", "Arn"] },
          InputTransformer: {
            InputPathsMap: {
              detailType: "$.detail-type",
              bucket: "$.detail.bucket.name",
              key: "$.detail.object.key",
              size: "$.detail.object.size",
              etag: "$.detail.object.etag",
            },
            InputTemplate:
              '{"type": <detailType>, "bucket": <bucket>, "key": <key>, "size": <size>, "eTag": <etag>}',
          },
        },
      ],
    });
  }),
) {}
