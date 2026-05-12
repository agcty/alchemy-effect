import type * as rulesets from "@distilled.cloud/cloudflare/rulesets";
import type { Ruleset, RulesetPhase } from "./Ruleset.ts";

type RulesetResponse = rulesets.GetPhasResponse | rulesets.PutPhasResponse;

export const toRulesetAttributes = <Phase extends RulesetPhase>(
  zoneId: string,
  ruleset: RulesetResponse,
): Ruleset<Phase>["Attributes"] => ({
  rulesetId: ruleset.id,
  zoneId,
  phase: ruleset.phase as Phase,
  name: ruleset.name,
  description: ruleset.description ?? undefined,
  rules: (ruleset.rules ?? []).map(({ lastUpdated, version, ...rule }) => rule),
  lastUpdated: ruleset.lastUpdated,
  version: ruleset.version,
});
