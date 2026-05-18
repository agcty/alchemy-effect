import * as Cloudflare from "@/Cloudflare";
import { CloudflareEnvironment } from "@/Cloudflare/CloudflareEnvironment";
import * as Test from "@/Test/Vitest";
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
