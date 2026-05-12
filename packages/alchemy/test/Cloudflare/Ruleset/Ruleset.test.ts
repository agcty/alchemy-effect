import * as Cloudflare from "@/Cloudflare";
import * as Test from "@/Test/Vitest";
import * as rulesets from "@distilled.cloud/cloudflare/rulesets";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { MinimumLogLevel } from "effect/References";

const { test } = Test.make({ providers: Cloudflare.providers() });

const logLevel = Effect.provideService(
  MinimumLogLevel,
  process.env.DEBUG ? "Debug" : "Info",
);

const zoneName =
  process.env.CLOUDFLARE_TEST_RULESET_ZONE_NAME ?? "alchemy-test-2.us";
const phase = "http_request_firewall_custom";
type TestRulesetPhase = typeof phase;

test.provider(
  "creates, updates, and deletes a zone phase entrypoint ruleset",
  (stack) =>
    Effect.gen(function* () {
      yield* stack.destroy();

      const initial = yield* stack.deploy(
        Effect.gen(function* () {
          return yield* Cloudflare.Ruleset("TestRuleset", {
            zone: zoneName,
            phase,
            rules: [
              {
                description: "Alchemy test rule",
                expression: "false",
                action: "block",
              },
            ],
          });
        }),
      );

      expect(initial.phase).toEqual(phase);
      expect(initial.rules).toHaveLength(1);

      const updated = yield* stack.deploy(
        Effect.gen(function* () {
          return yield* Cloudflare.Ruleset("TestRuleset", {
            zone: zoneName,
            phase,
            rules: [
              {
                description: "Updated Alchemy test rule",
                expression: "false",
                action: "managed_challenge",
              },
            ],
          });
        }),
      );

      expect(updated.zoneId).toEqual(initial.zoneId);
      expect(updated.rules[0]?.description).toEqual(
        "Updated Alchemy test rule",
      );
      expect(updated.rules[0]?.action).toEqual("managed_challenge");

      yield* stack.destroy();

      const actualRules = yield* getPhaseRules(initial.zoneId, phase);
      expect(actualRules).toEqual([]);
    }).pipe(logLevel),
);

const getPhaseRules = Effect.fn(function* (
  zoneId: string,
  phase: TestRulesetPhase,
) {
  return yield* rulesets
    .getPhasForZone({
      zoneId,
      rulesetPhase: phase,
    })
    .pipe(
      Effect.map((ruleset) => ruleset.rules),
      Effect.catchIf(isNotFoundError, () => Effect.succeed([])),
    );
});

const isNotFoundError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (("status" in error && (error as { status: unknown }).status === 404) ||
    ("_tag" in error && (error as { _tag: unknown })._tag === "NotFound"));
