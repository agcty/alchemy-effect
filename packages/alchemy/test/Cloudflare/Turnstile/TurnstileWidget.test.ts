import * as Cloudflare from "@/Cloudflare";
import { CloudflareEnvironment } from "@/Cloudflare/CloudflareEnvironment";
import * as Test from "@/Test/Vitest";
import * as turnstile from "@distilled.cloud/cloudflare/turnstile";
import { expect } from "@effect/vitest";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { MinimumLogLevel } from "effect/References";
import * as Schedule from "effect/Schedule";

const { test } = Test.make({ providers: Cloudflare.providers() });

const logLevel = Effect.provideService(
  MinimumLogLevel,
  process.env.DEBUG ? "Debug" : "Info",
);

test.provider(
  "create, update, delete turnstile widget",
  (stack) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareEnvironment;

      yield* stack.destroy();

      const widget = yield* stack.deploy(
        Effect.gen(function* () {
          return yield* Cloudflare.TurnstileWidget("TestWidget", {
            name: "alchemy-test-turnstile-widget",
            domains: ["example.com"],
          });
        }),
      );

      expect(widget.sitekey).toBeDefined();
      expect(Redacted.value(widget.secret)).toBeDefined();
      expect(widget.name).toEqual("alchemy-test-turnstile-widget");
      expectDomains(widget.domains, ["example.com"]);
      expect(widget.mode).toEqual("managed");
      expect(widget.region).toEqual("world");

      const actualWidget = yield* turnstile.getWidget({
        accountId,
        sitekey: widget.sitekey,
      });
      expect(actualWidget.sitekey).toEqual(widget.sitekey);
      expect(actualWidget.name).toEqual(widget.name);

      const updatedWidget = yield* stack.deploy(
        Effect.gen(function* () {
          return yield* Cloudflare.TurnstileWidget("TestWidget", {
            name: "alchemy-test-turnstile-widget-updated",
            domains: ["example.com", "www.example.com"],
            mode: "invisible",
          });
        }),
      );

      expect(updatedWidget.sitekey).toEqual(widget.sitekey);
      expect(updatedWidget.name).toEqual(
        "alchemy-test-turnstile-widget-updated",
      );
      expectDomains(updatedWidget.domains, ["example.com", "www.example.com"]);
      expect(updatedWidget.mode).toEqual("invisible");

      const actualUpdatedWidget = yield* turnstile.getWidget({
        accountId,
        sitekey: updatedWidget.sitekey,
      });
      expect(actualUpdatedWidget.name).toEqual(updatedWidget.name);
      expectDomains(actualUpdatedWidget.domains, updatedWidget.domains);
      expect(actualUpdatedWidget.mode).toEqual(updatedWidget.mode);

      const reorderedDomainsWidget = yield* stack.deploy(
        Effect.gen(function* () {
          return yield* Cloudflare.TurnstileWidget("TestWidget", {
            name: "alchemy-test-turnstile-widget-updated",
            domains: ["www.example.com", "example.com"],
            mode: "invisible",
          });
        }),
      );

      expect(reorderedDomainsWidget.sitekey).toEqual(updatedWidget.sitekey);
      expect(reorderedDomainsWidget.modifiedOn).toEqual(
        updatedWidget.modifiedOn,
      );
      expectDomains(reorderedDomainsWidget.domains, updatedWidget.domains);

      yield* stack.destroy();

      yield* waitForWidgetToBeDeleted(widget.sitekey, accountId);
    }).pipe(logLevel),
  { timeout: 60_000 },
);

test.provider(
  "manage existing turnstile widget by sitekey",
  (stack) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareEnvironment;

      yield* stack.destroy();

      const external = yield* turnstile.createWidget({
        accountId,
        name: "alchemy-test-turnstile-existing",
        domains: ["example.com"],
        mode: "managed",
      });

      const managed = yield* stack.deploy(
        Effect.gen(function* () {
          return yield* Cloudflare.TurnstileWidget("ExistingWidget", {
            sitekey: external.sitekey,
            name: "alchemy-test-turnstile-existing-managed",
            domains: ["example.com", "docs.example.com"],
            mode: "non-interactive",
          });
        }),
      );

      expect(managed.sitekey).toEqual(external.sitekey);
      expect(managed.name).toEqual("alchemy-test-turnstile-existing-managed");
      expectDomains(managed.domains, ["example.com", "docs.example.com"]);
      expect(managed.mode).toEqual("non-interactive");

      const replacement = yield* stack.deploy(
        Effect.gen(function* () {
          return yield* Cloudflare.TurnstileWidget("ExistingWidget", {
            name: "alchemy-test-turnstile-existing-replacement",
            domains: ["example.com"],
          });
        }),
      );

      expect(replacement.sitekey).not.toEqual(external.sitekey);
      expect(replacement.name).toEqual(
        "alchemy-test-turnstile-existing-replacement",
      );
      expectDomains(replacement.domains, ["example.com"]);

      yield* waitForWidgetToBeDeleted(external.sitekey, accountId);

      yield* stack.destroy();

      yield* waitForWidgetToBeDeleted(replacement.sitekey, accountId);
    }).pipe(logLevel),
  { timeout: 60_000 },
);

const waitForWidgetToBeDeleted = Effect.fn(function* (
  sitekey: string,
  accountId: string,
) {
  yield* turnstile
    .getWidget({
      accountId,
      sitekey,
    })
    .pipe(
      Effect.flatMap(() => Effect.fail(new WidgetStillExists())),
      Effect.retry({
        while: (e): e is WidgetStillExists => e instanceof WidgetStillExists,
        schedule: Schedule.exponential(100).pipe(
          Schedule.both(Schedule.recurs(8)),
        ),
      }),
      Effect.catchTag("WidgetStillExists", () =>
        Effect.die(
          `Cloudflare Turnstile widget ${sitekey} was not deleted after retries`,
        ),
      ),
      Effect.catchIf(isMissingTurnstileWidget, () => Effect.void),
    );
});

class WidgetStillExists extends Data.TaggedError("WidgetStillExists") {}

const isMissingTurnstileWidget = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (("_tag" in error && (error as { _tag: unknown })._tag === "NotFound") ||
    ("_tag" in error &&
      (error as { _tag: unknown })._tag === "CloudflareHttpError" &&
      "status" in error &&
      (error as { status: unknown }).status === 404));

const expectDomains = (actual: string[], expected: string[]) => {
  expect([...actual].sort()).toEqual([...expected].sort());
};
