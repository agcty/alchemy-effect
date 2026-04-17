import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

export default Alchemy.Stack(
  "CloudflareVite",
  {
    providers: Cloudflare.providers(),
  },
  Effect.gen(function* () {
    const worker = yield* Cloudflare.StaticSite("Website", {
      command: "bun vite build",
      dev: {
        command: "bun vite dev",
      },
      outdir: "dist",
      main: "./src/worker.ts",
    });

    return {
      url: worker.url,
    };
  }),
);
