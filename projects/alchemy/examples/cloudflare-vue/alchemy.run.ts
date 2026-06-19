import * as Alchemy from "@oddlynew/alchemy";
import * as Cloudflare from "@oddlynew/alchemy/Cloudflare";
import * as Effect from "effect/Effect";

export default Alchemy.Stack(
  "CloudflareVueExample",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const worker = yield* Cloudflare.Vite("Vue", {
      compatibility: {
        flags: ["nodejs_compat"],
      },
      memo: {},
    });

    return {
      url: worker.url,
    };
  }),
);
