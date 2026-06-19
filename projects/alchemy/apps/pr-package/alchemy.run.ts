import * as PrPackage from "@oddlynew/alchemy-pr-package";
import * as Alchemy from "@oddlynew/alchemy";
import * as Cloudflare from "@oddlynew/alchemy/Cloudflare";
import * as Output from "@oddlynew/alchemy/Output";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import Api from "./src/Api.ts";

export default Alchemy.Stack(
  "PrPackage",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const authToken = yield* PrPackage.AuthTokenValue;
    const api = yield* Api;
    return {
      url: api.url.as<string>(),
      // Unwrap the Redacted so the stack output emits the real token —
      // otherwise it serializes to the literal string "<redacted>".
      authToken: authToken.text.pipe(Output.map(Redacted.value)),
    };
  }),
);
