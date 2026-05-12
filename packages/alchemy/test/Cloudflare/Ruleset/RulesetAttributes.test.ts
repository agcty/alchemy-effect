import { toRulesetAttributes } from "@/Cloudflare/Ruleset/attributes";
import type * as rulesets from "@distilled.cloud/cloudflare/rulesets";
import { expect, it } from "@effect/vitest";

const emptyPhaseEntrypoint = {
  id: "ruleset-123",
  kind: "zone",
  lastUpdated: "2026-05-12T09:04:24.408357Z",
  name: "alchemy-test-ruleset",
  phase: "http_request_firewall_custom",
  version: "18",
  description: "",
} as rulesets.GetPhasResponse;

it("normalizes Cloudflare phase entrypoint responses that omit rules", () => {
  expect(toRulesetAttributes("zone-123", emptyPhaseEntrypoint).rules).toEqual(
    [],
  );
});

it("strips Cloudflare rule metadata from managed ruleset output", () => {
  const withRule = {
    ...emptyPhaseEntrypoint,
    rules: [
      {
        id: "rule-123",
        lastUpdated: "2026-05-12T09:04:24.408357Z",
        version: "1",
        description: "Alchemy test rule",
        expression: 'http.request.uri.path eq "/__alchemy_ruleset_test__"',
        action: "block",
      },
    ],
  } as rulesets.GetPhasResponse;

  expect(toRulesetAttributes("zone-123", withRule).rules).toEqual([
    {
      id: "rule-123",
      description: "Alchemy test rule",
      expression: 'http.request.uri.path eq "/__alchemy_ruleset_test__"',
      action: "block",
    },
  ]);
});
