import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

export const Browser = Cloudflare.BrowserRendering({ name: "BROWSER" });

export default class BrowserRenderingEffectWorker extends Cloudflare.Worker<BrowserRenderingEffectWorker>()(
  "BrowserRenderingEffectWorker",
  {
    main: import.meta.filename,
  },
  Effect.gen(function* () {
    const browserRendering = yield* Cloudflare.BrowserRendering.bind(
      yield* Browser,
    );

    return {
      fetch: Effect.gen(function* () {
        const binding = yield* browserRendering.raw;
        return yield* HttpServerResponse.json({
          mode: "effect",
          bound: binding != null,
        });
      }),
    };
  }).pipe(Effect.provide(Cloudflare.BrowserRenderingBindingLive)),
) {}
