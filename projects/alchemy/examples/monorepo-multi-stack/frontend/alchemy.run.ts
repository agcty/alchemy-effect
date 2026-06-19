import * as Alchemy from "@oddlynew/alchemy";
import * as Cloudflare from "@oddlynew/alchemy/Cloudflare";
import { Backend } from "@oddlynew/alchemy-example-monorepo-multi-stack-backend";
import * as Effect from "effect/Effect";

export default Alchemy.Stack(
  "Frontend",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    // reference the prod stage of the backend
    const backend = yield* Backend;

    const website = yield* Cloudflare.Vite("Website", {
      env: {
        VITE_API_URL: backend.url,
      },
    });

    return {
      url: website.url.as<string>(),
    };
  }),
);
