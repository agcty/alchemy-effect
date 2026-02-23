import * as Duration from "effect/Duration";
import * as Stream from "effect/Stream";

import { flow } from "effect/Function";
import * as Lambda from "./AWS/Lambda/index.ts";
import * as S3 from "./AWS/S3/index.ts";
import * as SQS from "./AWS/SQS/index.ts";
import { Stage } from "./Stage.ts";

export default Lambda.Function("JobFunction", function* () {
  // initialize resources
  const bucket = yield* S3.Bucket("Jobs");
  const queue = yield* SQS.Queue("Jobs");

  // subscribe to S3 notifications and forward to SQS queue
  yield* S3.notifications(bucket, {
    events: ["s3:ObjectCreated:*"],
  }).subscribe(flow(Stream.tapSink(yield* SQS.sink(queue)), Stream.runDrain));

  // return Function props
  const stage = yield* Stage;
  return {
    main: import.meta.filename,
    url: true,
    timeout: Duration.seconds(stage === "prod" ? 30 : 120),
    memory: stage === "prod" ? 1024 : 512,
  };
});
