import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import { HttpServerRequest } from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

/**
 * Effect-native Worker fixture that exercises the real Cloudflare RateLimit
 * binding via `RateLimitBindingLive`. It declares a rate limit during the Init
 * phase, binds it with `Cloudflare.RateLimit.bind`, and exposes a `/burst`
 * route that calls `rateLimit.limit({ key })` `n` times against a single
 * isolate.
 *
 * Driving the limit inside one request makes throttling deterministic (no
 * reliance on edge propagation between requests): with `limit: 2` the first
 * two calls for a key succeed and the rest are denied, while a different key
 * gets its own independent budget.
 */
export default class RateLimitEffectWorker extends Cloudflare.Worker<RateLimitEffectWorker>()(
  "RateLimitEffectWorker",
  {
    main: import.meta.filename,
  },
  Effect.gen(function* () {
    const rateLimit = yield* Cloudflare.RateLimit({
      name: "THROTTLE",
      namespaceId: 11_001,
      simple: { limit: 2, period: 10 },
    });

    const throttle = yield* Cloudflare.RateLimit.bind(rateLimit);

    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest;
        const url = new URL(request.originalUrl);

        if (url.pathname === "/burst") {
          const key = url.searchParams.get("key") ?? "default";
          const n = Number(url.searchParams.get("n") ?? "5");

          const results: boolean[] = [];
          for (let i = 0; i < n; i++) {
            const { success } = yield* throttle
              .limit({ key })
              .pipe(Effect.orDie);
            results.push(success);
          }

          return yield* HttpServerResponse.json({ key, results });
        }

        return HttpServerResponse.text("ok");
      }),
    };
  }).pipe(Effect.provide(Cloudflare.RateLimitBindingLive)),
) {}
