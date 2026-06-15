import { CloudflareEnvironment } from "@/Cloudflare/CloudflareEnvironment";
import * as Cloudflare from "@/Cloudflare/index.ts";
import * as Vite from "@/Cloudflare/Workers/Vite.ts";
import * as Test from "@/Test/Vitest";
import { PlatformServices } from "@/Util/PlatformServices.ts";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import { MinimumLogLevel } from "effect/References";
import * as Schedule from "effect/Schedule";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as pathe from "pathe";
import { test as vitestTest } from "vitest";
import { cloneFixture } from "../Utils/Fixture.ts";
import { expectUrlContains } from "../Utils/Http.ts";
import {
  expectWorkerExists,
  waitForWorkerToBeDeleted,
} from "../Utils/Worker.ts";
import type { Counter as ViteDoCounter } from "./vite-do-fixture/src/worker.ts";

const { test } = Test.make({ providers: Cloudflare.providers() });

const logLevel = Effect.provideService(
  MinimumLogLevel,
  process.env.DEBUG ? "Debug" : "Info",
);

const fixtureDir = pathe.resolve(import.meta.dirname, "vite-fixture");
const doFixtureDir = pathe.resolve(import.meta.dirname, "vite-do-fixture");

// Vite/Rollup's `vite:build-html` plugin chokes when the project root
// is outside the current working directory because it tries to express
// the emitted asset path relative to `cwd`. To keep the temp clone
// reachable via a sane relative path, allocate the temp dir *inside*
// the alchemy package's `.tmp/` so it sits under the same workspace
// root as `cwd`.
const tempRoot = pathe.resolve(import.meta.dirname, "../../../.tmp");

vitestTest(
  "Vite: ignores manifest-like files copied into client assets",
  async () => {
    const build = Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* fs.makeDirectory(tempRoot, { recursive: true });
      const rootDir = yield* fs.makeTempDirectory({
        prefix: "alchemy-vite-spa-manifest-",
        directory: tempRoot,
      });
      yield* fs.makeDirectory(path.join(rootDir, "public"));
      yield* fs.makeDirectory(path.join(rootDir, "src"));
      yield* fs.writeFileString(
        path.join(rootDir, "index.html"),
        '<div id="app"></div><script type="module" src="/src/main.ts"></script>\n',
      );
      yield* fs.writeFileString(
        path.join(rootDir, "src/main.ts"),
        'document.getElementById("app")!.textContent = "spa";\n',
      );
      yield* fs.writeFileString(
        path.join(rootDir, "public/__distilled-build.json"),
        "not json\n",
      );

      return yield* Vite.viteBuild(
        rootDir,
        {},
        {
          compatibilityDate: "2026-03-17",
          compatibilityFlags: [],
        },
      );
    });

    const output = await Effect.runPromise(
      build.pipe(Effect.provide(PlatformServices)),
    );
    expect(output.distilled).toBeUndefined();
    expect(output.serverBundle).toBeUndefined();
    expect(output.assetsDirectory).toBeDefined();
  },
);

test.provider(
  "Vite: editing a source file republishes the assets in a single deploy",
  (stack) =>
    Effect.gen(function* () {
      const { accountId } = yield* yield* CloudflareEnvironment;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      yield* stack.destroy();

      const rootDir = yield* cloneFixture(fixtureDir, {
        prefix: "alchemy-vite-fix-",
        tempRoot,
        entries: ["index.html", "package.json", "vite.config.ts", "src"],
      });
      const indexPath = path.join(rootDir, "index.html");

      // Restrict the input memo to fixture sources so the test isn't
      // re-hashing the whole monorepo on every deploy.
      const memoInclude = [
        "index.html",
        "src/**",
        "package.json",
        "vite.config.ts",
      ];

      const v1Marker = `vite-v1-${Date.now()}`;
      yield* fs.writeFileString(indexPath, htmlPage(v1Marker));

      const site1 = yield* stack.deploy(
        Effect.gen(function* () {
          return yield* Cloudflare.Vite(
            "FixVite",
            viteProps(rootDir, memoInclude),
          );
        }),
      );

      expect(site1.url).toBeDefined();
      expect(site1.hash?.input).toBeDefined();
      yield* expectWorkerExists(site1.workerName, accountId);
      yield* expectUrlContains(`${site1.url!}/`, v1Marker, {
        timeout: "120 seconds",
        label: "deploy1 v1 marker",
      });

      // ── deploy 2: edit fixture, redeploy once ──────────────────────────
      const v2Marker = `vite-v2-${Date.now()}`;
      yield* fs.writeFileString(indexPath, htmlPage(v2Marker));

      const site2 = yield* stack.deploy(
        Effect.gen(function* () {
          return yield* Cloudflare.Vite(
            "FixVite",
            viteProps(rootDir, memoInclude),
          );
        }),
      );

      expect(site2.hash?.input).toBeDefined();
      expect(site2.hash?.input).not.toEqual(site1.hash?.input);
      yield* expectUrlContains(`${site2.url!}/`, v2Marker, {
        timeout: "60 seconds",
        label: "deploy2 v2 marker",
      });

      yield* stack.destroy();
      yield* waitForWorkerToBeDeleted(site1.workerName, accountId);
    }).pipe(logLevel),
  { timeout: 360_000 },
);

test.provider(
  "Vite: class form deploys and serves the built assets",
  (stack) =>
    Effect.gen(function* () {
      const { accountId } = yield* yield* CloudflareEnvironment;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      yield* stack.destroy();

      const rootDir = yield* cloneFixture(fixtureDir, {
        prefix: "alchemy-vite-class-",
        tempRoot,
        entries: ["index.html", "package.json", "vite.config.ts", "src"],
      });
      const indexPath = path.join(rootDir, "index.html");
      const memoInclude = [
        "index.html",
        "src/**",
        "package.json",
        "vite.config.ts",
      ];

      const marker = `vite-class-${Date.now()}`;
      yield* fs.writeFileString(indexPath, htmlPage(marker));

      const site1 = yield* stack.deploy(
        Effect.gen(function* () {
          return yield* class FixVite extends Cloudflare.Vite<FixVite>()(
            "FixVite",
            viteProps(rootDir, memoInclude),
          ) {};
        }),
      );

      expect(site1.url).toBeDefined();
      expect(site1.hash?.input).toBeDefined();
      yield* expectWorkerExists(site1.workerName, accountId);
      yield* expectUrlContains(`${site1.url!}/`, marker, {
        timeout: "120 seconds",
        label: "class form marker",
      });

      yield* stack.destroy();
      yield* waitForWorkerToBeDeleted(site1.workerName, accountId);
    }).pipe(logLevel),
  { timeout: 360_000 },
);

// ─────────────────────────────────────────────────────────────────────
// Path-relocation behavior for the vite path
//
// `Cloudflare.Vite` stores a path-insensitive `hash.input` made from
// the memo'd input tree plus build-affecting Vite options. The diff is:
//
//   `input !== output.hash?.input`
//
// — a pure content comparison that must be stable across rootDir
// moves. We delete the original rootDir between deploys to make the
// test fail loudly if anything still depends on the recorded path.
// ─────────────────────────────────────────────────────────────────────

test.provider(
  "Vite: relocating rootDir (and deleting the old one) is a no-op when sources are identical",
  (stack) =>
    Effect.gen(function* () {
      const { accountId } = yield* yield* CloudflareEnvironment;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      yield* stack.destroy();

      const memoInclude = [
        "index.html",
        "src/**",
        "package.json",
        "vite.config.ts",
      ];
      const marker = `vite-relocate-${Date.now()}`;

      const rootA = yield* cloneFixture(fixtureDir, {
        prefix: "alchemy-vite-relocate-a-",
        tempRoot,
        entries: ["index.html", "package.json", "vite.config.ts", "src"],
      });
      yield* fs.writeFileString(
        path.join(rootA, "index.html"),
        htmlPage(marker),
      );

      const site1 = yield* stack.deploy(
        Effect.gen(function* () {
          return yield* Cloudflare.Vite(
            "ViteReloc",
            viteProps(rootA, memoInclude),
          );
        }),
      );
      expect(site1.hash?.input).toBeDefined();
      yield* expectUrlContains(`${site1.url!}/`, marker, {
        timeout: "120 seconds",
        label: "deploy1 marker",
      });

      // Drop rootA so a stale path comparison can't quietly succeed.
      yield* fs.remove(rootA, { recursive: true });

      const rootB = yield* cloneFixture(fixtureDir, {
        prefix: "alchemy-vite-relocate-b-",
        tempRoot,
        entries: ["index.html", "package.json", "vite.config.ts", "src"],
      });
      yield* fs.writeFileString(
        path.join(rootB, "index.html"),
        htmlPage(marker),
      );

      const site2 = yield* stack.deploy(
        Effect.gen(function* () {
          return yield* Cloudflare.Vite(
            "ViteReloc",
            viteProps(rootB, memoInclude),
          );
        }),
      );

      // Identical sources ⇒ identical input hash ⇒ diff says
      // unchanged ⇒ no rebuild required for the apply to succeed.
      expect(site2.hash?.input).toEqual(site1.hash?.input);
      yield* expectUrlContains(`${site2.url!}/`, marker, {
        timeout: "60 seconds",
        label: "deploy2 marker",
      });

      yield* stack.destroy();
      yield* waitForWorkerToBeDeleted(site1.workerName, accountId);
    }).pipe(logLevel),
  { timeout: 360_000 },
);

test.provider(
  "Vite: `env` props are inlined and env-only changes redeploy",
  (stack) =>
    Effect.gen(function* () {
      const { accountId } = yield* yield* CloudflareEnvironment;

      yield* stack.destroy();

      const rootDir = yield* cloneFixture(fixtureDir, {
        prefix: "alchemy-vite-env-",
        tempRoot,
        entries: ["index.html", "package.json", "vite.config.ts", "src"],
      });
      const memoInclude = ["index.html", "src/**", "package.json"];
      const marker1 = `vite-env-1-${Date.now()}`;

      const site1 = yield* stack.deploy(
        Effect.gen(function* () {
          return yield* Cloudflare.Vite("FixViteEnv", {
            ...viteProps(rootDir, memoInclude),
            env: { VITE_TEST_MARKER: marker1 },
          });
        }),
      );

      expect(site1.url).toBeDefined();
      expect(site1.hash?.input).toBeDefined();
      // Resolve the hashed bundle URL by reading the deployed HTML, then
      // assert the marker that `main.ts` references via
      // `import.meta.env.VITE_TEST_MARKER` was actually inlined into the
      // served JS asset by `Cloudflare.Vite`'s `env`-→-`define` plumbing.
      const bundleUrl1 = yield* discoverBundleUrl(site1.url!);
      yield* expectUrlContains(bundleUrl1, marker1, {
        timeout: "60 seconds",
        label: "VITE_TEST_MARKER v1 inlined into client bundle",
      });

      const marker2 = `vite-env-2-${Date.now()}`;
      const site2 = yield* stack.deploy(
        Effect.gen(function* () {
          return yield* Cloudflare.Vite("FixViteEnv", {
            ...viteProps(rootDir, memoInclude),
            env: { VITE_TEST_MARKER: marker2 },
          });
        }),
      );

      expect(site2.hash?.input).toBeDefined();
      expect(site2.hash?.input).not.toEqual(site1.hash?.input);
      const bundleUrl2 = yield* discoverBundleUrl(site2.url!);
      yield* expectUrlContains(bundleUrl2, marker2, {
        timeout: "60 seconds",
        label: "VITE_TEST_MARKER v2 inlined into client bundle",
      });

      yield* stack.destroy();
      yield* waitForWorkerToBeDeleted(site1.workerName, accountId);
    }).pipe(logLevel),
  { timeout: 360_000 },
);

test.provider(
  "Vite: worker entry can host a local Durable Object binding",
  (stack) =>
    Effect.gen(function* () {
      const { accountId } = yield* yield* CloudflareEnvironment;

      yield* stack.destroy();

      const rootDir = yield* cloneFixture(doFixtureDir, {
        prefix: "alchemy-vite-do-",
        tempRoot,
        // Keep the fixture's real stack file available for local
        // `alchemy dev` smoke tests. The live deploy below uses an inline
        // stack so cleanup stays under the provider test harness.
        entries: [
          "alchemy.run.ts",
          "index.html",
          "package.json",
          "vite.config.ts",
          "src",
        ],
      });
      const memoInclude = [
        "index.html",
        "src/**",
        "package.json",
        "vite.config.ts",
      ];
      const compatibility = {
        date: "2026-03-17",
        flags: ["nodejs_compat"],
      };
      const assets = {
        runWorkerFirst: ["/api/*"],
      };
      // Direct build assertion covers the distilled Vite manifest contract;
      // the live deploy assertion below proves Cloudflare.Vite consumes the
      // same manifest bundle instead of falling back to the legacy ssr output.
      const build = yield* Vite.viteBuild(
        rootDir,
        {},
        {
          compatibilityDate: compatibility.date,
          compatibilityFlags: compatibility.flags,
          assets,
        },
      );
      const distilled = build.distilled;
      expect(distilled).toBeDefined();
      expect(distilled!.manifest.workers.app.main).toBe("server/worker.js");
      expect(distilled!.manifest.workers.app.modules).toContainEqual({
        path: "server/worker.js",
        type: "esm",
      });
      expect(distilled!.manifest.assets?.runWorkerFirst).toEqual(["/api/*"]);
      expect(distilled!.bundle.files).toContainEqual(
        expect.objectContaining({
          path: "server/worker.js",
          contentType: "application/javascript+module",
        }),
      );

      const site = yield* stack.deploy(
        Effect.gen(function* () {
          return yield* Cloudflare.Vite("ViteDo", {
            ...viteProps(rootDir, memoInclude),
            compatibility,
            assets,
            env: {
              Counter: Cloudflare.DurableObjectNamespace<ViteDoCounter>(
                "Counter",
                {
                  className: "Counter",
                },
              ),
            },
          });
        }),
      );

      expect(site.url).toBeDefined();
      expect(site.hash?.bundle).toEqual(distilled!.bundle.hash);
      yield* expectWorkerExists(site.workerName, accountId);
      yield* expectUrlContains(`${site.url!}/`, "Vite DO fixture", {
        timeout: "120 seconds",
        label: "vite do fixture assets",
      });

      const reset = yield* fetchJsonReady<{ ok: boolean }>(
        `${site.url!}/api/reset`,
      );
      expect(reset.ok).toBe(true);

      const first = yield* fetchJsonReady<{ count: number }>(
        `${site.url!}/api/count`,
      );
      expect(first.count).toBe(1);

      const second = yield* fetchJsonReady<{ count: number }>(
        `${site.url!}/api/count`,
      );
      expect(second.count).toBe(2);

      yield* stack.destroy();
      yield* waitForWorkerToBeDeleted(site.workerName, accountId);
    }).pipe(logLevel),
  { timeout: 360_000 },
);

const freshConn = HttpClient.mapRequest(
  HttpClientRequest.setHeader("connection", "close"),
);

const fetchJsonReady = <T>(url: string) =>
  Effect.gen(function* () {
    const client = freshConn(yield* HttpClient.HttpClient);
    return yield* client.get(url).pipe(
      Effect.flatMap((res) =>
        res.status === 200
          ? Effect.flatMap(res.text, (body) =>
              Effect.try({
                try: () => JSON.parse(body) as T,
                catch: () => new Error(`non-json body: ${body}`),
              }),
            )
          : Effect.fail(new Error(`Worker not ready: ${res.status}`)),
      ),
      Effect.retry({
        schedule: Schedule.exponential("500 millis"),
        times: 15,
      }),
    );
  });

const discoverBundleUrl = (siteUrl: string) =>
  Effect.gen(function* () {
    const client = HttpClient.filterStatusOk(yield* HttpClient.HttpClient);
    return yield* Effect.gen(function* () {
      const res = yield* client.get(`${siteUrl}/`);
      const html = yield* res.text;
      const match = html.match(
        /<script[^>]+src="(\/assets\/[^"]+\.js)"[^>]*>/i,
      );
      if (!match) {
        // Fresh deploys can briefly return Cloudflare's "There is
        // nothing here yet" HTML page instead of the SPA index — retry.
        return yield* Effect.fail(
          new Error(
            `Could not find /assets/*.js script tag in HTML: ${html.slice(0, 200)}`,
          ),
        );
      }
      return `${siteUrl}${match[1]}`;
    }).pipe(
      Effect.retry({
        schedule: Schedule.exponential("500 millis"),
        times: 10,
      }),
    );
  });

const viteProps = (rootDir: string, memoInclude: string[]) => ({
  rootDir,
  url: true as const,
  subdomain: { enabled: true, previewsEnabled: true },
  compatibility: {
    date: "2024-09-23",
    flags: ["nodejs_compat"],
  },
  memo: { include: memoInclude },
});

const htmlPage = (marker: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${marker}</title>
  </head>
  <body>
    <div id="app">${marker}</div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`;
