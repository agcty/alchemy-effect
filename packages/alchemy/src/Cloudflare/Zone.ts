import * as zones from "@distilled.cloud/cloudflare/zones";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";

export type ZoneReference = string | { zoneId: string; name?: string };

export const isZoneId = (zone: string): boolean => /^[a-f0-9]{32}$/i.test(zone);

export const matchesZoneHostname = (
  zoneName: string,
  hostname: string,
): boolean => hostname === zoneName || hostname.endsWith(`.${zoneName}`);

export const resolveZoneId = ({
  accountId,
  zone,
  hostname,
}: {
  accountId: string;
  zone: ZoneReference | undefined;
  hostname: string;
}) =>
  Effect.gen(function* () {
    if (typeof zone === "object") return zone.zoneId;
    if (typeof zone === "string" && isZoneId(zone)) return zone;

    const lookup = zone ?? hostname;
    const match = yield* zones.listZones.items({}).pipe(
      Stream.filter(
        (candidate) =>
          candidate.account.id === accountId &&
          matchesZoneHostname(candidate.name, lookup),
      ),
      Stream.runHead,
      Effect.map(Option.getOrUndefined),
    );
    if (!match) {
      return yield* Effect.fail(
        new Error(`Cloudflare zone not found for ${lookup}`),
      );
    }
    return match.id;
  });
