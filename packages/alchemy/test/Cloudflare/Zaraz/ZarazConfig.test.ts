import * as Cloudflare from "@/Cloudflare";
import * as Test from "@/Test/Vitest";
import * as zaraz from "@distilled.cloud/cloudflare/zaraz";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { MinimumLogLevel } from "effect/References";

const { test } = Test.make({ providers: Cloudflare.providers() });

const logLevel = Effect.provideService(
  MinimumLogLevel,
  process.env.DEBUG ? "Debug" : "Info",
);

const zoneId = process.env.CLOUDFLARE_TEST_ZARAZ_ZONE_ID;
const zoneName =
  process.env.CLOUDFLARE_TEST_ZARAZ_ZONE_NAME ?? "alchemy-test-2.us";

test.provider.skipIf(!zoneId)(
  "updates and retains a zone-level Zaraz config",
  (stack) =>
    Effect.gen(function* () {
      yield* stack.destroy();

      const original = yield* zaraz.getConfig({ zoneId: zoneId! });
      const toggledDataLayer = !original.dataLayer;

      yield* Effect.gen(function* () {
        const updated = yield* stack.deploy(
          Effect.gen(function* () {
            return yield* Cloudflare.ZarazConfig("Config", {
              zone: { zoneId: zoneId!, name: zoneName },
              dataLayer: toggledDataLayer,
            });
          }),
        );

        expect(updated.zoneId).toEqual(zoneId);
        expect(updated.dataLayer).toEqual(toggledDataLayer);

        const liveUpdated = yield* zaraz.getConfig({ zoneId: zoneId! });
        expect(liveUpdated.dataLayer).toEqual(toggledDataLayer);

        const restored = yield* stack.deploy(
          Effect.gen(function* () {
            return yield* Cloudflare.ZarazConfig("Config", {
              zone: { zoneId: zoneId!, name: zoneName },
              dataLayer: original.dataLayer,
            });
          }),
        );

        expect(restored.dataLayer).toEqual(original.dataLayer);

        yield* stack.destroy();

        const liveRetained = yield* zaraz.getConfig({ zoneId: zoneId! });
        expect(liveRetained.dataLayer).toEqual(original.dataLayer);
      }).pipe(
        Effect.ensuring(
          zaraz.putConfig(toPutConfig(zoneId!, original)).pipe(Effect.ignore),
        ),
      );
    }).pipe(logLevel),
  { timeout: 120_000 },
);

test.provider.skipIf(!zoneId)(
  "delete true resets Zaraz config to defaults",
  (stack) =>
    Effect.gen(function* () {
      yield* stack.destroy();

      const original = yield* zaraz.getConfig({ zoneId: zoneId! });
      const defaults = yield* zaraz.getDefault({ zoneId: zoneId! });

      yield* Effect.gen(function* () {
        yield* stack.deploy(
          Effect.gen(function* () {
            return yield* Cloudflare.ZarazConfig("Config", {
              zone: { zoneId: zoneId!, name: zoneName },
              dataLayer: !defaults.dataLayer,
              delete: true,
            });
          }),
        );

        const liveUpdated = yield* zaraz.getConfig({ zoneId: zoneId! });
        expect(liveUpdated.dataLayer).toEqual(!defaults.dataLayer);

        yield* stack.destroy();

        const liveDeleted = yield* zaraz.getConfig({ zoneId: zoneId! });
        expect(liveDeleted.dataLayer).toEqual(defaults.dataLayer);
      }).pipe(
        Effect.ensuring(
          zaraz.putConfig(toPutConfig(zoneId!, original)).pipe(Effect.ignore),
        ),
      );
    }).pipe(logLevel),
  { timeout: 120_000 },
);

type ConfigResponse = zaraz.GetConfigResponse | zaraz.PutConfigResponse;

const toPutConfig = (
  zoneId: string,
  config: ConfigResponse,
): zaraz.PutConfigRequest =>
  stripUndefinedFields({
    zoneId,
    dataLayer: config.dataLayer,
    debugKey: config.debugKey,
    settings: stripNullFields(config.settings),
    tools: config.tools,
    triggers: config.triggers,
    variables: config.variables,
    zarazVersion: config.zarazVersion,
    analytics: config.analytics ? stripNullFields(config.analytics) : undefined,
    consent: config.consent ? stripNullFields(config.consent) : undefined,
    historyChange: config.historyChange ?? undefined,
  }) as zaraz.PutConfigRequest;

const stripNullFields = <T>(value: T): T => stripFields(value, null) as T;

const stripUndefinedFields = <T>(value: T): T =>
  stripFields(value, undefined) as T;

const stripFields = (value: unknown, empty: null | undefined): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => stripFields(item, empty));
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== empty)
      .map(([key, entry]) => [key, stripFields(entry, empty)]),
  );
};
