import * as Cloudflare from "@/Cloudflare";
import type { Fetcher } from "@cloudflare/workers-types";
import * as Effect from "effect/Effect";

export const Worker = Cloudflare.Worker("BrowserRenderingTypesWorker", {
  main: import.meta.filename,
  bindings: {
    BROWSER: Cloudflare.BrowserRendering(),
  },
});

type WorkerEnv = Cloudflare.InferEnv<typeof Worker>;

declare const env: WorkerEnv;

const response: Promise<Response> = env.BROWSER.fetch("https://example.com");

void response;

declare const client: Cloudflare.BrowserRenderingClient;

const puppeteer = {
  launch: async (_binding: Fetcher) => ({
    close: async () => {},
    newPage: async () => ({
      title: async () => "example",
    }),
  }),
};

const launched = client.launch(puppeteer);
const used = client.withBrowser(puppeteer, (browser) =>
  Effect.tryPromise(() => browser.newPage()),
);

void launched;
void used;
