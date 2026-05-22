import * as Cloudflare from "@/Cloudflare";
import { CloudflareEnvironment } from "@/Cloudflare/CloudflareEnvironment";
import { makeBrowserRenderingClient } from "@/Cloudflare/BrowserRendering/BrowserRenderingBinding";
import * as Test from "@/Test/Vitest";
import type { Fetcher } from "@cloudflare/workers-types";
import * as workers from "@distilled.cloud/cloudflare/workers";
import { expect } from "@effect/vitest";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as HttpClient from "effect/unstable/http/HttpClient";
import Stack from "./fixtures/browser-rendering/stack.ts";

const { test } = Test.make({ providers: Cloudflare.providers() });
const hasCloudflareCredentials = Boolean(
  process.env.CLOUDFLARE_ACCOUNT_ID &&
  (process.env.CLOUDFLARE_API_TOKEN ||
    (process.env.CLOUDFLARE_API_KEY && process.env.CLOUDFLARE_EMAIL)),
);

class WorkerNotReady extends Data.TaggedError("WorkerNotReady")<{
  status: number;
  body: string;
}> {}

const binding = {
  fetch: async () => new Response("ok"),
} as unknown as Fetcher;

test(
  "effect-native client launches and closes browser sessions",
  Effect.gen(function* () {
    let launchedWith: Fetcher | undefined;
    let closeCount = 0;

    const client = makeBrowserRenderingClient(Effect.succeed(binding));

    const puppeteer = {
      launch: async (runtimeBinding: Fetcher) => {
        launchedWith = runtimeBinding;
        return {
          close: async () => {
            closeCount += 1;
          },
          newPage: async () => ({
            title: async () => "example",
          }),
        };
      },
    };

    const title = yield* client.withBrowser(puppeteer, (browser) =>
      Effect.gen(function* () {
        const page = yield* Effect.tryPromise(() => browser.newPage());
        return yield* Effect.tryPromise(() => page.title());
      }),
    );
    const error = yield* Effect.flip(
      client.withBrowser(puppeteer, () => Effect.fail("boom")),
    );

    expect(launchedWith).toBe(binding);
    expect(title).toBe("example");
    expect(error).toBe("boom");
    expect(closeCount).toBe(2);
  }).pipe(
    Effect.provideService(Cloudflare.WorkerEnvironment, {}),
    Effect.orDie,
  ),
);

test.provider.skipIf(!hasCloudflareCredentials)(
  "fixtures cover async and Effect Browser Rendering bindings",
  (stack) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareEnvironment;

      yield* stack.destroy();

      const { output: deployed } = yield* stack.deploy(Stack);

      const asyncSettings = yield* workers.getScriptScriptAndVersionSetting({
        accountId,
        scriptName: deployed.asyncWorkerName,
      });
      expect(asyncSettings.bindings).toEqual(
        expect.arrayContaining([
          {
            type: "browser",
            name: "BROWSER",
          },
        ]),
      );

      const effectSettings = yield* workers.getScriptScriptAndVersionSetting({
        accountId,
        scriptName: deployed.effectWorkerName,
      });
      expect(effectSettings.bindings).toEqual(
        expect.arrayContaining([
          {
            type: "browser",
            name: "BROWSER",
          },
        ]),
      );

      const readJson = (url: string) =>
        HttpClient.HttpClient.pipe(
          Effect.flatMap((client) => client.get(url)),
          Effect.flatMap((res) =>
            res.status === 200
              ? res.json
              : res.text.pipe(
                  Effect.flatMap((body) =>
                    Effect.fail(
                      new WorkerNotReady({ status: res.status, body }),
                    ),
                  ),
                ),
          ),
        ).pipe(
          Effect.retry({
            while: (e): e is WorkerNotReady =>
              e instanceof WorkerNotReady && e.status >= 400 && e.status < 500,
            schedule: Schedule.exponential("500 millis").pipe(
              Schedule.both(Schedule.recurs(20)),
            ),
          }),
        );

      const asyncBody = yield* readJson(deployed.asyncWorkerUrl);
      const effectBody = yield* readJson(deployed.effectWorkerUrl);

      expect(asyncBody).toEqual({ mode: "async", bound: true });
      expect(effectBody).toEqual({ mode: "effect", bound: true });

      yield* stack.destroy();
    }),
  { timeout: 180_000 },
);
