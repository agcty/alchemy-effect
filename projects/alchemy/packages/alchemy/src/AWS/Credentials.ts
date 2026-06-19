import { Credentials } from "@oddlynew/distilled-aws/Credentials";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { AWSEnvironment } from "./Environment.ts";

export { Credentials } from "@oddlynew/distilled-aws/Credentials";

/**
 * Lazy `Credentials` layer derived from the surrounding {@link AWSEnvironment}.
 * Credentials are resolved on first access (not during layer construction),
 * matching the existing @oddlynew/distilled-aws semantics.
 */
export const fromEnvironment = Layer.effect(
  Credentials,
  Effect.gen(function* () {
    return Effect.flatMap(yield* AWSEnvironment, (env) => env.credentials);
  }),
);
