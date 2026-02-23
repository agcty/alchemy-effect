import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Resource } from "../../Resource.ts";
import * as Lambda from "../Lambda/index.ts";
import type { Bucket } from "./Bucket.ts";

export interface BucketEventSourceProps<
  B extends Bucket,
  F extends Lambda.Function,
> {
  bucket: B;
  function: F;
}

export interface BucketEventSource<
  ID extends string,
  B extends Bucket,
  F extends Lambda.Function,
> extends Resource<
  "AWS.S3.BucketEventSource",
  ID,
  BucketEventSourceProps<B, F>,
  {}
> {}

export const BucketEventSource = Resource<{
  <const ID extends string, B extends Bucket, F extends Lambda.Function>(
    id: ID,
    props: BucketEventSourceProps<B, F>,
  ): Effect.Effect<BucketEventSource<ID, B, F>>;
}>("AWS.S3.BucketEventSource");

export const BucketEventSourceProvider = Layer.effect(
  BucketEventSource,
  Effect.gen(function* () {
    return BucketEventSource.of({
      create: Effect.fn(function* (input) {
        return undefined!;
      }),
      delete: Effect.fn(function* (input) {
        return undefined!;
      }),
      update: Effect.fn(function* (input) {
        return undefined!;
      }),
    });
  }),
);
// export const BucketEventSourceLambda = Binding.effect(
//   [Lambda.Function, BucketEventSource],
//   Effect.fn(function* (self, bucket) {
//     yield* Lambda.EventSourceMapping(`${bucket.id}-EventSource`, {
//       functionName: yield* self.functionName(),
//       eventSourceArn: yield* bucket.bucketArn(),
//     });

//     return {
//       policyStatements: [
//         {
//           Sid: "S3BucketEventSource",
//           Effect: "Allow",
//           Action: ["s3:GetObject"],
//           Resource: yield* bucket.bucketArn(),
//         },
//       ],
//     };
//   }),
// );
