import type * as cf from "@cloudflare/workers-types";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Binding from "../../Binding.ts";
import type { ResourceLike } from "../../Resource.ts";
import { isWorker, WorkerEnvironment } from "../Workers/Worker.ts";
import type { BrowserRendering as BrowserRenderingLike } from "./BrowserRendering.ts";

/**
 * Effect-native client for a Cloudflare Browser Rendering binding.
 *
 * Browser Rendering's Workers binding is consumed by `@cloudflare/puppeteer`,
 * so Alchemy exposes the native binding without wrapping Puppeteer's API.
 */
export interface BrowserRenderingClient {
  /**
   * Effect resolving to the raw Cloudflare Browser Rendering runtime binding.
   */
  raw: Effect.Effect<cf.Fetcher, never, WorkerEnvironment>;
}

export class BrowserRenderingBinding extends Binding.Service<
  BrowserRenderingBinding,
  (browser: BrowserRenderingLike) => Effect.Effect<BrowserRenderingClient>
>()("Cloudflare.BrowserRendering.Binding") {}

export const BrowserRenderingBindingLive = Layer.effect(
  BrowserRenderingBinding,
  Effect.gen(function* () {
    const Policy = yield* BrowserRenderingBindingPolicy;

    return Effect.fn(function* (browser: BrowserRenderingLike) {
      yield* Policy(browser);
      // Cloudflare exposes Browser Rendering as a service-style binding for
      // @cloudflare/puppeteer; workers-types has no narrower interface.
      const raw = WorkerEnvironment.useSync(
        (env) => (env as Record<string, cf.Fetcher>)[browser.name]!,
      );

      return {
        raw,
      } satisfies BrowserRenderingClient;
    });
  }),
);

export class BrowserRenderingBindingPolicy extends Binding.Policy<
  BrowserRenderingBindingPolicy,
  (browser: BrowserRenderingLike) => Effect.Effect<void>
>()("Cloudflare.BrowserRendering.Binding") {}

export const BrowserRenderingBindingPolicyLive =
  BrowserRenderingBindingPolicy.layer.succeed(
    Effect.fn(function* (host: ResourceLike, browser: BrowserRenderingLike) {
      if (isWorker(host)) {
        yield* host.bind(browser.name, {
          bindings: [
            {
              type: "browser",
              name: browser.name,
            },
          ],
        });
      } else {
        return yield* Effect.die(
          new Error(
            `BrowserRenderingBinding does not support runtime '${host.Type}'`,
          ),
        );
      }
    }),
  );
