import * as zones from "@distilled.cloud/cloudflare/zones";
import * as Effect from "effect/Effect";
import { deepEqual, isResolved } from "../../Diff.ts";
import * as Provider from "../../Provider.ts";
import { Resource } from "../../Resource.ts";
import { CloudflareEnvironment } from "../CloudflareEnvironment.ts";
import type { Providers } from "../Providers.ts";
import { findZoneByName as findCloudflareZoneByName } from "../Zone.ts";

export type ZoneType = "full" | "partial" | "secondary" | "internal";

export type ZoneProps = {
  /**
   * Domain name for the zone.
   */
  name: string;
  /**
   * Zone setup type.
   * @default "full"
   */
  type?: ZoneType;
  /**
   * Whether the zone is paused.
   */
  paused?: boolean;
  /**
   * Vanity name servers for the zone. Only available on supported Cloudflare
   * plans.
   */
  vanityNameServers?: string[];
  /**
   * Whether the zone should be deleted when the resource is destroyed.
   *
   * Set to `false` when representing an existing production zone that should
   * outlive the stack.
   * @default true
   */
  delete?: boolean;
};

export type Zone = Resource<
  "Cloudflare.Zone",
  ZoneProps,
  {
    zoneId: string;
    accountId: string;
    name: string;
    type: ZoneType | undefined;
    status: "initializing" | "pending" | "active" | "moved" | undefined;
    paused: boolean | undefined;
    nameServers: string[];
    originalNameServers: string[] | null;
    createdOn: string;
    modifiedOn: string;
    activatedOn: string | null;
    vanityNameServers: string[] | undefined;
  },
  never,
  Providers
>;

export const isZone = (value: unknown): value is Zone =>
  typeof value === "object" &&
  value !== null &&
  "Type" in value &&
  (value as Zone).Type === "Cloudflare.Zone";

/**
 * A Cloudflare DNS zone.
 *
 * Zones represent domains managed by Cloudflare. They can be used directly by
 * zone-scoped resources such as Rulesets and R2 custom domains.
 *
 * @section Existing Zone
 * @example Reference a production zone without deleting it on destroy
 * ```typescript
 * const zone = yield* Cloudflare.Zone("Zone", {
 *   name: "example.com",
 *   type: "full",
 *   delete: false,
 * });
 * ```
 *
 * @section Creating a Zone
 * @example Full zone
 * ```typescript
 * const zone = yield* Cloudflare.Zone("Zone", {
 *   name: "example.com",
 * });
 * ```
 */
export const Zone = Resource<Zone>("Cloudflare.Zone")({});

type ZoneResponse =
  | zones.GetZoneResponse
  | zones.CreateZoneResponse
  | zones.PatchZoneResponse;

const toZoneAttributes = (
  zone: ZoneResponse | zones.ListZonesResponse["result"][number],
  accountId: string,
): Zone["Attributes"] => ({
  zoneId: zone.id,
  accountId: zone.account.id ?? accountId,
  name: zone.name,
  type: zone.type ?? undefined,
  status: zone.status ?? undefined,
  paused: zone.paused ?? undefined,
  nameServers: zone.nameServers,
  originalNameServers: zone.originalNameServers,
  createdOn: zone.createdOn,
  modifiedOn: zone.modifiedOn,
  activatedOn: zone.activatedOn,
  vanityNameServers: zone.vanityNameServers ?? undefined,
});

const mutablePropsChanged = (
  attrs: Zone["Attributes"],
  props: ZoneProps,
): boolean =>
  attrs.type !== (props.type ?? "full") ||
  attrs.paused !== (props.paused ?? false) ||
  !deepEqual(attrs.vanityNameServers, props.vanityNameServers);

const isNotFoundError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (("status" in error && (error as { status: unknown }).status === 404) ||
    ("_tag" in error && (error as { _tag: unknown })._tag === "NotFound"));

export const ZoneProvider = () =>
  Provider.effect(
    Zone,
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareEnvironment;
      const getZone = yield* zones.getZone;
      const createZone = yield* zones.createZone;
      const patchZone = yield* zones.patchZone;
      const deleteZone = yield* zones.deleteZone;

      const findZoneByName = (name: string) =>
        findCloudflareZoneByName({ accountId, name });

      const readById = (zoneId: string) =>
        getZone({ zoneId }).pipe(
          Effect.map((zone) => toZoneAttributes(zone, accountId)),
          Effect.catchIf(isNotFoundError, () => Effect.succeed(undefined)),
        );

      return {
        stables: ["zoneId", "accountId", "name"],
        diff: Effect.fn(function* ({ olds, news, output }) {
          if (!isResolved(news)) return undefined;
          if ((output?.accountId ?? accountId) !== accountId) {
            return { action: "replace" } as const;
          }
          if (output?.name && output.name !== news.name) {
            return { action: "replace" } as const;
          }
          if (olds.name && olds.name !== news.name) {
            return { action: "replace" } as const;
          }
          if (output && mutablePropsChanged(output, news)) {
            return { action: "update" } as const;
          }
          if (
            olds.type !== news.type ||
            olds.paused !== news.paused ||
            !deepEqual(olds.vanityNameServers, news.vanityNameServers)
          ) {
            return { action: "update" } as const;
          }
        }),
        reconcile: Effect.fn(function* ({ news, output }) {
          let observed = output?.zoneId
            ? yield* readById(output.zoneId)
            : undefined;

          if (!observed) {
            const existing = yield* findZoneByName(news.name);
            observed = existing ? yield* readById(existing.id) : undefined;
          }

          if (!observed) {
            observed = toZoneAttributes(
              yield* createZone({
                account: { id: accountId },
                name: news.name,
                type: news.type ?? "full",
              }),
              accountId,
            );
          }

          if (mutablePropsChanged(observed, news)) {
            observed = toZoneAttributes(
              yield* patchZone({
                zoneId: observed.zoneId,
                type: news.type,
                paused: news.paused,
                vanityNameServers: news.vanityNameServers,
              }),
              accountId,
            );
          }

          return observed;
        }),
        delete: Effect.fn(function* ({ olds, output }) {
          if (olds.delete === false) return;
          yield* deleteZone({ zoneId: output.zoneId }).pipe(
            Effect.catchIf(isNotFoundError, () => Effect.void),
          );
        }),
        read: Effect.fn(function* ({ output, olds }) {
          if (output?.zoneId) {
            const observed = yield* readById(output.zoneId);
            if (observed) return observed;
          }

          const existing = yield* findZoneByName(olds.name);
          return existing ? yield* readById(existing.id) : undefined;
        }),
      };
    }),
  );
