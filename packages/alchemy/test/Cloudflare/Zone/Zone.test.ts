import * as Cloudflare from "@/Cloudflare";
import { CloudflareEnvironment } from "@/Cloudflare/CloudflareEnvironment";
import { findZoneByName as findCloudflareZoneByName } from "@/Cloudflare/Zone.ts";
import * as Test from "@/Test/Vitest";
import * as zones from "@distilled.cloud/cloudflare/zones";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { MinimumLogLevel } from "effect/References";

const { test } = Test.make({ providers: Cloudflare.providers() });

const logLevel = Effect.provideService(
  MinimumLogLevel,
  process.env.DEBUG ? "Debug" : "Info",
);

const zoneName = process.env.CLOUDFLARE_TEST_ZONE_NAME;

test.provider.skipIf(!zoneName)(
  "adopts existing zone and respects delete false",
  (stack) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareEnvironment;
      const existing = yield* findTestZoneByName(zoneName!, accountId);

      yield* stack.destroy();

      const zone = yield* stack.deploy(
        Effect.gen(function* () {
          return yield* Cloudflare.Zone("TestZone", {
            name: zoneName!,
            type: existing.type ?? undefined,
            paused: existing.paused ?? undefined,
            vanityNameServers: existing.vanityNameServers ?? undefined,
            delete: false,
          });
        }),
      );

      expect(zone.name).toEqual(zoneName);
      expect(zone.accountId).toEqual(accountId);
      expect(zone.zoneId).toBeTruthy();

      const actual = yield* zones.getZone({ zoneId: zone.zoneId });
      expect(actual.name).toEqual(zoneName);

      yield* stack.destroy();

      const retained = yield* zones.getZone({ zoneId: zone.zoneId });
      expect(retained.name).toEqual(zoneName);
    }).pipe(logLevel),
);

const findTestZoneByName = Effect.fn(function* (
  name: string,
  accountId: string,
) {
  const match = yield* findCloudflareZoneByName({ accountId, name }).pipe(
    Effect.flatMap((zone) =>
      zone
        ? Effect.succeed(zone)
        : Effect.fail(new Error(`Cloudflare test zone not found: ${name}`)),
    ),
  );
  return yield* zones.getZone({ zoneId: match.id });
});
