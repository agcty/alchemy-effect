import * as sqs from "distilled-aws/sqs";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import type { Input } from "../../Input.ts";
import { Resource } from "../../Resource.ts";
import type { PolicyDocument } from "../IAM/index.ts";

export interface QueuePolicyProps {
  /**
   * URL of the SQS queue to attach the policy to.
   */
  queueUrl: Input<string>;
  /**
   * The IAM policy document to apply to the queue.
   * Must include `Version: "2012-10-17"`.
   */
  policy: Input<PolicyDocument>;
}

export interface QueuePolicyAttrs<
  Props extends Input.Resolve<QueuePolicyProps>,
> {
  /**
   * URL of the queue the policy is attached to.
   */
  queueUrl: Props["queueUrl"];
}

export const QueuePolicy = Resource<{
  <const ID extends string, const Props extends QueuePolicyProps>(
    id: ID,
    props: Props,
  ): Effect.Effect<QueuePolicy<ID, Props>>;
}>("AWS.SQS.QueuePolicy");

export interface QueuePolicy<
  ID extends string = string,
  Props extends QueuePolicyProps = QueuePolicyProps,
> extends Resource<
  "AWS.SQS.QueuePolicy",
  ID,
  Props,
  QueuePolicyAttrs<Input.Resolve<Props>>
> {}

const retryInvalidPolicy: <A, R, Err>(
  self: Effect.Effect<A, Err, R>,
) => Effect.Effect<A, Err, R> = Effect.retry({
  while: (e: any) =>
    e._tag === "InvalidAttributeValue" &&
    !!e.message?.includes("Invalid value for the parameter Policy"),
  schedule: Schedule.exponential(200).pipe(
    Schedule.both(Schedule.recurs(10)),
  ),
});

export const QueuePolicyProvider = () =>
  Layer.effect(
    QueuePolicy,
    Effect.gen(function* () {
      return {
        stables: ["queueUrl"],
        diff: Effect.fn(function* ({ news, olds }) {
          if ((olds.queueUrl as string) !== (news.queueUrl as string)) {
            return { action: "replace" } as const;
          }
        }),
        create: Effect.fn(function* ({ news, session }) {
          const queueUrl = news.queueUrl as string;

          yield* sqs
            .setQueueAttributes({
              QueueUrl: queueUrl,
              Attributes: {
                Policy: JSON.stringify(news.policy),
              },
            })
            .pipe(retryInvalidPolicy);

          yield* session.note(`Applied policy to queue: ${queueUrl}`);

          return {
            queueUrl,
          };
        }),
        update: Effect.fn(function* ({ news, output, session }) {
          yield* sqs
            .setQueueAttributes({
              QueueUrl: output.queueUrl,
              Attributes: {
                Policy: JSON.stringify(news.policy),
              },
            })
            .pipe(retryInvalidPolicy);

          yield* session.note(`Updated policy on queue: ${output.queueUrl}`);
          return output;
        }),
        delete: Effect.fn(function* ({ output, session }) {
          yield* sqs
            .setQueueAttributes({
              QueueUrl: output.queueUrl,
              Attributes: {
                Policy: "",
              },
            })
            .pipe(
              Effect.catchTag("QueueDoesNotExist", () => Effect.void),
            );

          yield* session.note(
            `Removed policy from queue: ${output.queueUrl}`,
          );
        }),
      };
    }),
  );
