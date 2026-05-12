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

const zoneId = process.env.CLOUDFLARE_TEST_EMPTY_RULESET_ZONE_ID;
const phase = "http_request_firewall_custom";
type TestRulesetPhase = typeof phase;

test.provider.skipIf(!zoneId)(
  "creates, updates, and deletes a zone phase entrypoint ruleset",
  (stack) =>
    Effect.gen(function* () {
      const existingRules = yield* getPhaseRules(zoneId!, phase);
      expect(existingRules).toEqual([]);

      yield* stack.destroy();

      const initial = yield* stack.deploy(
        Effect.gen(function* () {
          return yield* Cloudflare.Ruleset("TestRuleset", {
            zone: { zoneId: zoneId! },
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

      expect(initial.zoneId).toEqual(zoneId);
      expect(initial.phase).toEqual(phase);
      expect(initial.rules).toHaveLength(1);

      const updated = yield* stack.deploy(
        Effect.gen(function* () {
          return yield* Cloudflare.Ruleset("TestRuleset", {
            zone: { zoneId: zoneId! },
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

      expect(updated.rules[0]?.description).toEqual(
        "Updated Alchemy test rule",
      );
      expect(updated.rules[0]?.action).toEqual("managed_challenge");

      yield* stack.destroy();

      const actualRules = yield* getPhaseRules(zoneId!, phase);
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
