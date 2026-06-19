import * as Alchemy from "@oddlynew/alchemy";
import * as Cloudflare from "@oddlynew/alchemy/Cloudflare";
import * as Effect from "effect/Effect";

export default Alchemy.Stack(
  "CloudflareSolidStartExample",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const worker = yield* Cloudflare.Vite("CloudflareSolidStart", {
      compatibility: {
        flags: ["nodejs_compat"],
      },
    });

    return {
      url: worker.url,
    };
  }),
);
