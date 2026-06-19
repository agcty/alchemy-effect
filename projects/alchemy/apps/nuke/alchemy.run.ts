import * as Alchemy from "@oddlynew/alchemy";
import * as AWS from "@oddlynew/alchemy/AWS";
import * as Cloudflare from "@oddlynew/alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

export default Alchemy.Stack(
  "Nuke",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), AWS.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {}),
);
