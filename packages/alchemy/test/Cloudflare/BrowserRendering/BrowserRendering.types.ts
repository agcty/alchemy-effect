import * as Cloudflare from "@/Cloudflare";

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
