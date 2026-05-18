import * as rulesets from "@distilled.cloud/cloudflare/rulesets";
import * as Effect from "effect/Effect";
import { deepEqual, isResolved } from "../../Diff.ts";
import { createPhysicalName } from "../../PhysicalName.ts";
import * as Provider from "../../Provider.ts";
import { Resource } from "../../Resource.ts";
import { CloudflareEnvironment } from "../CloudflareEnvironment.ts";
import type { Providers } from "../Providers.ts";
import {
  isZoneId,
  resolveZoneId as resolveCloudflareZoneId,
  type ZoneReference,
} from "../Zone.ts";
import { toRulesetAttributes } from "./attributes.ts";

export type RulesetPhase = rulesets.CreateRulesetForZoneRequest["phase"];
export type RulesetRule = NonNullable<
  rulesets.PutPhasForZoneRequest["rules"]
>[number];
export type RulesetOutputRule = Omit<
  NonNullable<rulesets.GetPhasResponse["rules"]>[number],
  "lastUpdated" | "version"
>;

export type RulesetZone = ZoneReference;

export type RulesetProps<Phase extends RulesetPhase = RulesetPhase> = {
  /**
   * Zone to apply the ruleset to. Pass a zone ID string, a hostname in the
   * zone, or any object with a `zoneId` attribute such as `Cloudflare.Zone`.
   */
  zone: RulesetZone;
  /**
   * Ruleset phase entrypoint to own.
   */
  phase: Phase;
  /**
   * Rules to apply to the phase entrypoint.
   */
  rules: RulesetRule[];
  /**
   * Human-readable name for the ruleset.
   * @default ${app}-${stage}-${id}
   */
  name?: string;
  /**
   * Description for the ruleset.
   */
  description?: string;
};

export type Ruleset<Phase extends RulesetPhase = RulesetPhase> = Resource<
  "Cloudflare.Ruleset",
  RulesetProps<Phase>,
  {
    rulesetId: string;
    zoneId: string;
    phase: Phase;
    name: string;
    description: string | undefined;
    rules: RulesetOutputRule[];
    lastUpdated: string;
    version: string;
  },
  never,
  Providers
>;

/**
 * A Cloudflare Ruleset phase entrypoint for a zone.
 *
 * This resource owns the entire ruleset for a phase entrypoint. Rules managed
 * elsewhere in the same phase can be overwritten on deploy.
 *
 * @section WAF Rules
 * @example Block probes in the custom firewall phase
 * ```typescript
 * const waf = yield* Cloudflare.Ruleset("WafRules", {
 *   zone,
 *   phase: "http_request_firewall_custom",
 *   rules: [
 *     {
 *       description: "Block exploit probes",
 *       expression: `lower(http.request.uri.path) contains "/.env"`,
 *       action: "block",
 *     },
 *   ],
 * });
 * ```
 */
export const Ruleset = Resource<Ruleset>("Cloudflare.Ruleset")({});

const isNotFoundError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (("status" in error && (error as { status: unknown }).status === 404) ||
    ("_tag" in error && (error as { _tag: unknown })._tag === "NotFound"));

const zoneRef = (zone: RulesetZone): string =>
  typeof zone === "string" ? zone : zone.zoneId;

export const RulesetProvider = () =>
  Provider.effect(
    Ruleset,
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareEnvironment;
      const getPhas = yield* rulesets.getPhasForZone;
      const putPhas = yield* rulesets.putPhasForZone;

      const createRulesetName = (id: string, name: string | undefined) =>
        Effect.gen(function* () {
          return name ?? (yield* createPhysicalName({ id }));
        });

      const resolveZoneId = (zone: RulesetZone) =>
        resolveCloudflareZoneId({
          accountId,
          zone,
          hostname: typeof zone === "string" ? zone : (zone.name ?? ""),
        });

      return {
        stables: ["zoneId", "phase"],
        diff: Effect.fn(function* ({ id, olds, news, output }) {
          if (!isResolved(news)) return undefined;
          const desiredZone = zoneRef(news.zone);
          const desiredZoneId =
            typeof news.zone !== "string" || isZoneId(news.zone)
              ? desiredZone
              : undefined;
          const oldZone = olds.zone ? zoneRef(olds.zone) : undefined;
          const oldZoneId =
            olds.zone && (typeof olds.zone !== "string" || isZoneId(olds.zone))
              ? oldZone
              : undefined;

          if (
            output?.zoneId &&
            desiredZoneId &&
            desiredZoneId !== output.zoneId
          ) {
            return { action: "replace" } as const;
          }
          if (oldZoneId && desiredZoneId && oldZoneId !== desiredZoneId) {
            return { action: "replace" } as const;
          }
          if (
            olds.zone &&
            typeof olds.zone === "string" &&
            typeof news.zone === "string" &&
            oldZone !== desiredZone
          ) {
            return { action: "replace" } as const;
          }
          if (olds.phase !== news.phase) {
            return { action: "replace" } as const;
          }

          const oldName =
            output?.name ?? (yield* createRulesetName(id, olds.name));
          const name = yield* createRulesetName(id, news.name);
          if (
            oldName !== name ||
            olds.description !== news.description ||
            !deepEqual(olds.rules, news.rules)
          ) {
            return { action: "update" } as const;
          }
        }),
        reconcile: Effect.fn(function* ({ id, news, output }) {
          const zoneId = output?.zoneId ?? (yield* resolveZoneId(news.zone));
          const name = yield* createRulesetName(id, news.name ?? output?.name);
          const ruleset = yield* putPhas({
            zoneId,
            rulesetPhase: news.phase,
            name,
            description: news.description,
            rules: news.rules,
          });
          return toRulesetAttributes<typeof news.phase>(zoneId, ruleset);
        }),
        delete: Effect.fn(function* ({ olds, output }) {
          yield* putPhas({
            zoneId: output.zoneId,
            rulesetPhase: olds.phase,
            name: output.name,
            description: output.description,
            rules: [],
          }).pipe(Effect.catchIf(isNotFoundError, () => Effect.void));
        }),
        read: Effect.fn(function* ({ olds, output }) {
          const zoneId = output?.zoneId ?? (yield* resolveZoneId(olds.zone));
          return yield* getPhas({
            zoneId,
            rulesetPhase: output?.phase ?? olds.phase,
          }).pipe(
            Effect.map((ruleset) => toRulesetAttributes(zoneId, ruleset)),
            Effect.catchIf(isNotFoundError, () => Effect.succeed(undefined)),
          );
        }),
      };
    }),
  );
