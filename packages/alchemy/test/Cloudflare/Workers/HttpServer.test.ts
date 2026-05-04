import { serveWebRequest } from "@/Cloudflare/Workers/HttpServer";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as HttpEffect from "effect/unstable/http/HttpEffect";
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

const helloHandler = Effect.succeed(
  HttpServerResponse.text("hello", { status: 200 }),
);

describe("serveWebRequest", () => {
  it.effect(
    "drains preResponseHandlers so HttpMiddleware.cors() tags GET responses",
    () =>
      Effect.gen(function* () {
        const request = new Request("https://worker.test/hello", {
          method: "GET",
          headers: { Origin: "https://example.test" },
        });

        const response = yield* serveWebRequest(
          request as any,
          HttpMiddleware.cors()(helloHandler),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("access-control-allow-origin")).toBe("*");
        expect(yield* Effect.promise(() => response.text())).toBe("hello");
      }),
  );

  it.effect(
    "lets HttpMiddleware.cors() answer OPTIONS preflight with CORS headers",
    () =>
      Effect.gen(function* () {
        const request = new Request("https://worker.test/hello", {
          method: "OPTIONS",
          headers: {
            Origin: "https://example.test",
            "Access-Control-Request-Method": "GET",
          },
        });

        const response = yield* serveWebRequest(
          request as any,
          HttpMiddleware.cors()(helloHandler),
        );

        expect(response.status).toBe(204);
        expect(response.headers.get("access-control-allow-origin")).toBe("*");
      }),
  );

  it.effect(
    "applies a manually-registered preResponseHandler to the response",
    () =>
      Effect.gen(function* () {
        const handler = helloHandler.pipe(
          HttpEffect.withPreResponseHandler((_req, res) =>
            Effect.succeed(HttpServerResponse.setHeader(res, "x-tagged", "yes")),
          ),
        );

        const request = new Request("https://worker.test/", { method: "GET" });
        const response = yield* serveWebRequest(request as any, handler);

        expect(response.headers.get("x-tagged")).toBe("yes");
      }),
  );
});
