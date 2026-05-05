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

const zoneId = process.env.CLOUDFLARE_TEST_RULESET_ZONE_ID;

test.provider.skipIf(!zoneId)(
  "creates, updates, and deletes a zone phase entrypoint ruleset",
  (stack) =>
    Effect.gen(function* () {
      yield* stack.destroy();

      const initial = yield* stack.deploy(
        Effect.gen(function* () {
          return yield* Cloudflare.Ruleset("TestRuleset", {
            zone: { zoneId: zoneId! },
            phase: "http_request_firewall_custom",
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
      expect(initial.phase).toEqual("http_request_firewall_custom");
      expect(initial.rules).toHaveLength(1);

      const updated = yield* stack.deploy(
        Effect.gen(function* () {
          return yield* Cloudflare.Ruleset("TestRuleset", {
            zone: { zoneId: zoneId! },
            phase: "http_request_firewall_custom",
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

      const actual = yield* rulesets.getPhas({
        zoneId: zoneId!,
        rulesetPhase: "http_request_firewall_custom",
      } as any);
      expect(actual.rules).toHaveLength(0);
    }).pipe(logLevel),
);
