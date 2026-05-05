import * as Cloudflare from "@/Cloudflare";
import { CloudflareEnvironment } from "@/Cloudflare/CloudflareEnvironment";
import * as Test from "@/Test/Vitest";
import * as r2 from "@distilled.cloud/cloudflare/r2";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { MinimumLogLevel } from "effect/References";

const { test } = Test.make({ providers: Cloudflare.providers() });

const logLevel = Effect.provideService(
  MinimumLogLevel,
  process.env.DEBUG ? "Debug" : "Info",
);

const zoneId = process.env.CLOUDFLARE_TEST_R2_DOMAIN_ZONE_ID;
const domain = process.env.CLOUDFLARE_TEST_R2_DOMAIN;

test.provider.skipIf(!zoneId || !domain)(
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
    }).pipe(logLevel),
);
