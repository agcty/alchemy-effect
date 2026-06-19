import * as Alchemy from "@oddlynew/alchemy";
import * as Cloudflare from "@oddlynew/alchemy/Cloudflare";
import * as Effect from "effect/Effect";

export default Alchemy.Stack(
  "CloudflareSolidJSSSRExample",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const worker = yield* Cloudflare.Vite("SolidJSSrr", {
      compatibility: {
        flags: ["nodejs_compat"],
      },
      assets: {
        runWorkerFirst: true,
      },
    });

    return {
      url: worker.url,
    };
  }),
);
