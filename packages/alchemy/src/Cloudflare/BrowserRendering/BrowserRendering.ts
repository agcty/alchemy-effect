import * as Effect from "effect/Effect";
import { BrowserRenderingBinding } from "./BrowserRenderingBinding.ts";

type BrowserRenderingTypeId = typeof BrowserRenderingTypeId;
const BrowserRenderingTypeId = "Cloudflare.BrowserRendering" as const;

export type BrowserRenderingProps = {
  /**
   * Binding name used when `Cloudflare.BrowserRendering.bind(browser)` attaches
   * Browser Rendering from inside a Worker init phase. When Browser Rendering
   * is passed through `Worker({ bindings: { ... } })`, the object key remains
   * the binding name.
   *
   * @default "BROWSER"
   */
  name?: string;
};

/**
 * Marker for a Cloudflare Browser Rendering binding.
 *
 * Browser Rendering bindings are configured directly on Workers and do not
 * have a standalone provisioning API. The Worker provider sees this object in
 * `bindings: { ... }` and emits the corresponding `{ type: "browser" }`
 * metadata binding to the script.
 */
export type BrowserRendering = {
  kind: BrowserRenderingTypeId;
  name: string;
};

export const isBrowserRendering = (value: unknown): value is BrowserRendering =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  (value as BrowserRendering).kind === BrowserRenderingTypeId;

/**
 * A Cloudflare Browser Rendering binding for launching headless browser
 * sessions from Workers via `@cloudflare/puppeteer`.
 *
 * @binding
 *
 * @section Declaring Browser Rendering
 * @example
 * ```typescript
 * const Browser = yield* Cloudflare.BrowserRendering({ name: "BROWSER" });
 * ```
 *
 * @section Binding to a Worker (declarative)
 * @example
 * ```typescript
 * export const Worker = Cloudflare.Worker("Worker", {
 *   main: "./src/worker.ts",
 *   bindings: {
 *     BROWSER: Cloudflare.BrowserRendering(),
 *   },
 * });
 *
 * export type WorkerEnv = Cloudflare.InferEnv<typeof Worker>;
 * //   { BROWSER: Fetcher }
 * ```
 *
 * @example Async-style worker
 * ```typescript
 * import puppeteer from "@cloudflare/puppeteer";
 * import type { WorkerEnv } from "../alchemy.run.ts";
 *
 * export default {
 *   async fetch(request: Request, env: WorkerEnv) {
 *     const browser = await puppeteer.launch(env.BROWSER);
 *     const page = await browser.newPage();
 *     await page.goto("https://example.com");
 *     const screenshot = await page.screenshot();
 *     await browser.close();
 *
 *     return new Response(screenshot, {
 *       headers: { "content-type": "image/png" },
 *     });
 *   },
 * };
 * ```
 *
 * @section Effect-style Worker
 * @example Binding in the init phase
 * ```typescript
 * import puppeteer from "@cloudflare/puppeteer";
 *
 * const Browser = Cloudflare.BrowserRendering({ name: "BROWSER" });
 *
 * Cloudflare.Worker(
 *   "BrowserWorker",
 *   { main: import.meta.filename },
 *   Effect.gen(function* () {
 *     const browserRendering = yield* Cloudflare.BrowserRendering.bind(
 *       yield* Browser,
 *     );
 *
 *     return {
 *       fetch: Effect.gen(function* () {
 *         const binding = yield* browserRendering.raw;
 *         const browser = yield* Effect.promise(() =>
 *           puppeteer.launch(binding),
 *         );
 *         try {
 *           const page = yield* Effect.promise(() => browser.newPage());
 *           yield* Effect.promise(() => page.goto("https://example.com"));
 *           const title = yield* Effect.promise(() => page.title());
 *           return Response.json({ title });
 *         } finally {
 *           yield* Effect.promise(() => browser.close());
 *         }
 *       }),
 *     };
 *   }).pipe(Effect.provide(Cloudflare.BrowserRenderingBindingLive)),
 * );
 * ```
 *
 * @see https://developers.cloudflare.com/browser-rendering/workers-binding-api/
 */
export const BrowserRendering: {
  (props?: BrowserRenderingProps): Effect.Effect<BrowserRendering>;
  /**
   * Bind Browser Rendering to the surrounding Worker, returning a small client
   * with access to the native Workers runtime binding.
   */
  bind: typeof BrowserRenderingBinding.bind;
} = Object.assign(
  Effect.fn(function* (props?: BrowserRenderingProps) {
    return {
      kind: BrowserRenderingTypeId,
      name: props?.name ?? "BROWSER",
    } satisfies BrowserRendering;
  }),
  {
    bind: (...args: Parameters<typeof BrowserRenderingBinding.bind>) =>
      BrowserRenderingBinding.bind(...args),
  },
);
