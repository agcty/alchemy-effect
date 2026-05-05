import * as Cloudflare from "@/Cloudflare";
import { CloudflareEnvironment } from "@/Cloudflare/CloudflareEnvironment";
import * as Test from "@/Test/Vitest";
import * as r2 from "@distilled.cloud/cloudflare/r2";
import { expect } from "@effect/vitest";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import { MinimumLogLevel } from "effect/References";
import * as Schedule from "effect/Schedule";

const { test } = Test.make({ providers: Cloudflare.providers() });

const logLevel = Effect.provideService(
  MinimumLogLevel,
  process.env.DEBUG ? "Debug" : "Info",
);

const zoneId = process.env.CLOUDFLARE_TEST_R2_DOMAIN_ZONE_ID;
const zoneName = process.env.CLOUDFLARE_TEST_R2_DOMAIN_ZONE_NAME;
const domain = zoneName
  ? `alchemy-r2-test-${Math.random().toString(36).slice(2, 8)}.${zoneName}`
  : undefined;

test.provider.skipIf(!zoneId || !zoneName)(
  "creates, updates, and deletes a bucket custom domain",
  (stack) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareEnvironment;

      yield* stack.destroy();

      const bucket = yield* stack.deploy(
        Effect.gen(function* () {
          return yield* Cloudflare.R2Bucket("DomainBucket", {
            domains: {
              domain: domain!,
              zone: { zoneId: zoneId! },
            },
          });
        }),
      );

      expect(bucket.domains).toHaveLength(1);
      expect(bucket.domains[0]?.domain).toEqual(domain);
      expect(bucket.domains[0]?.enabled).toEqual(true);

      const actual = yield* r2.getBucketDomainCustom({
        accountId,
        bucketName: bucket.bucketName,
        domain: domain!,
        jurisdiction: bucket.jurisdiction,
      });
      expect(actual.domain).toEqual(domain);

      const updated = yield* stack.deploy(
        Effect.gen(function* () {
          return yield* Cloudflare.R2Bucket("DomainBucket", {
            domains: {
              domain: domain!,
              zone: { zoneId: zoneId! },
              enabled: false,
            },
          });
        }),
      );

      expect(updated.domains[0]?.enabled).toEqual(false);

      yield* stack.destroy();

      const deleted = yield* r2
        .getBucketDomainCustom({
          accountId,
          bucketName: bucket.bucketName,
          domain: domain!,
          jurisdiction: bucket.jurisdiction,
        })
        .pipe(
          Effect.map(() => false),
          Effect.catchTag("DomainNotFound", () => Effect.succeed(true)),
        );
      expect(deleted).toEqual(true);

      yield* waitForBucketToBeDeleted(bucket.bucketName, accountId);
    }).pipe(logLevel),
);

const waitForBucketToBeDeleted = Effect.fn(function* (
  bucketName: string,
  accountId: string,
) {
  yield* r2
    .getBucket({
      accountId,
      bucketName,
    })
    .pipe(
      Effect.flatMap(() => Effect.fail(new BucketStillExists())),
      Effect.retry({
        while: (e): e is BucketStillExists => e instanceof BucketStillExists,
        schedule: Schedule.exponential(100),
      }),
      Effect.catchTag("NoSuchBucket", () => Effect.void),
    );
});

class BucketStillExists extends Data.TaggedError("BucketStillExists") {}
