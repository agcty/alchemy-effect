import * as S3 from "distilled-aws/s3";
import * as Effect from "effect/Effect";
import * as Binding from "../../Binding.ts";
import * as Output from "../../Output/index.ts";
import * as Lambda from "../Lambda/index.ts";
import type { Bucket } from "./Bucket.ts";

export interface GetObjectRequest extends Omit<S3.GetObjectRequest, "Bucket"> {}

export const GetObject = Effect.fn(function* <B extends Bucket>(bucket: B) {
  yield* GetObjectPolicy.bind(bucket);

  // Bind the Bucket's bucketName Output to `this` environment
  const BucketName = yield* bucket.bucketName();

  return Effect.fn(function* (request: GetObjectRequest) {
    return yield* S3.getObject({
      ...request,
      Bucket: yield* BucketName,
    });
  });
});

export class GetObjectPolicy extends Binding.Policy<Bucket>()(
  "AWS.S3.GetObject",
) {}

export const GetObjectLambda = Binding.effect(
  [Lambda.Function, GetObjectPolicy],
  Effect.fn(function* (self, bucket) {
    return {
      policyStatements: [
        {
          Sid: "GetObject",
          Effect: "Allow",
          Action: ["s3:GetObject", "s3:GetObjectVersion"],
          Resource: [Output.interpolate`${bucket.bucketArn()}/*`],
        },
      ],
    };
  }),
);
