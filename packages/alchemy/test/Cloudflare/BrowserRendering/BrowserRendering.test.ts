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
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as pathe from "pathe";
import BrowserRenderingWorker from "./browser-rendering-worker.ts";

const { test } = Test.make({ providers: Cloudflare.providers() });
const main = pathe.resolve(import.meta.dirname, "fixtures/worker.ts");

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

test.provider(
  "worker bindings emit Cloudflare Browser Rendering metadata",
  (stack) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareEnvironment;

      yield* stack.destroy();

      const worker = yield* stack.deploy(
        Effect.gen(function* () {
          return yield* Cloudflare.Worker("BrowserRenderingWorker", {
            main,
            bindings: {
              BROWSER: Cloudflare.BrowserRendering({
                name: "IGNORED_BY_DIRECT_BINDING",
              }),
            },
          });
        }),
      );

      const settings = yield* workers.getScriptScriptAndVersionSetting({
        accountId,
        scriptName: worker.workerName,
      });
      expect(settings.bindings).toEqual(
        expect.arrayContaining([
          {
            type: "browser",
            name: "BROWSER",
          },
        ]),
      );

      yield* stack.destroy();
    }),
);

test.provider(
  "init-phase binding emits Cloudflare Browser Rendering metadata",
  (stack) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareEnvironment;

      yield* stack.destroy();

      const worker = yield* stack.deploy(
        Effect.gen(function* () {
          const browser = yield* Cloudflare.BrowserRendering({
            name: "BROWSER",
          });

          return yield* Cloudflare.Worker(
            "BrowserRenderingWorker",
            {
              main,
            },
            Effect.gen(function* () {
              yield* Cloudflare.BrowserRendering.bind(browser);
            }).pipe(Effect.provide(Cloudflare.BrowserRenderingBindingLive)),
          );
        }),
      );

      const settings = yield* workers.getScriptScriptAndVersionSetting({
        accountId,
        scriptName: worker.workerName,
      });
      expect(settings.bindings).toEqual(
        expect.arrayContaining([
          {
            type: "browser",
            name: "BROWSER",
          },
        ]),
      );

      yield* stack.destroy();
    }),
);

test.provider(
  "init-phase binding resolves Browser Rendering runtime binding",
  (stack) =>
    Effect.gen(function* () {
      yield* stack.destroy();

      const worker = yield* stack.deploy(
        Effect.gen(function* () {
          return yield* BrowserRenderingWorker;
        }),
      );

      expect(worker.url).toBeTypeOf("string");

      const body = yield* HttpClient.execute(
        HttpClientRequest.get(worker.url!),
      ).pipe(
        Effect.flatMap((res) =>
          res.status === 200
            ? res.json
            : res.text.pipe(
                Effect.flatMap((body) =>
                  Effect.fail(new WorkerNotReady({ status: res.status, body })),
                ),
              ),
        ),
        Effect.retry({
          while: (e): e is WorkerNotReady =>
            e instanceof WorkerNotReady && e.status >= 400 && e.status < 500,
          schedule: Schedule.exponential("500 millis").pipe(
            Schedule.both(Schedule.recurs(20)),
          ),
        }),
      );

      expect(body).toEqual({ bound: true });

      yield* stack.destroy();
    }),
  { timeout: 180_000 },
);
