import * as StripeCredentials from "@distilled.cloud/stripe/Credentials";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { AuthError, getAuthProvider } from "../Auth/AuthProvider.ts";
import { ALCHEMY_PROFILE, AlchemyProfile } from "../Auth/Profile.ts";
import {
  STRIPE_AUTH_PROVIDER_NAME,
  type StripeAuthConfig,
  type StripeResolvedCredentials,
} from "./AuthProvider.ts";

export {
  Credentials,
  DEFAULT_API_BASE_URL,
} from "@distilled.cloud/stripe/Credentials";

const readEnvSecretKey = Config.redacted("STRIPE_SECRET_KEY").pipe(
  Effect.catch(() =>
    Effect.fail(
      new AuthError({
        message: "Stripe credentials not found. Set STRIPE_SECRET_KEY.",
      }),
    ),
  ),
);

export const fromEnv = () =>
  Layer.succeed(
    StripeCredentials.Credentials,
    Effect.gen(function* () {
      const apiKey = yield* readEnvSecretKey;
      const apiBaseUrl = yield* Config.string("STRIPE_API_BASE_URL").pipe(
        Config.withDefault(StripeCredentials.DEFAULT_API_BASE_URL),
      );
      return { apiKey, apiBaseUrl } satisfies StripeCredentials.Config;
    }).pipe(Effect.orDie),
  );

export const fromToken = (
  secretKey: string | Redacted.Redacted<string>,
  options: { readonly apiBaseUrl?: string } = {},
) =>
  Layer.succeed(
    StripeCredentials.Credentials,
    Effect.succeed({
      apiKey:
        typeof secretKey === "string" ? Redacted.make(secretKey) : secretKey,
      apiBaseUrl: options.apiBaseUrl ?? StripeCredentials.DEFAULT_API_BASE_URL,
    } satisfies StripeCredentials.Config),
  );

export const fromAuthProvider = () =>
  Layer.effect(
    StripeCredentials.Credentials,
    Effect.gen(function* () {
      const profile = yield* AlchemyProfile;
      const auth = yield* getAuthProvider<
        StripeAuthConfig,
        StripeResolvedCredentials
      >(STRIPE_AUTH_PROVIDER_NAME);
      const profileName = yield* ALCHEMY_PROFILE;
      const ci = yield* Config.boolean("CI").pipe(Config.withDefault(false));

      return yield* profile.loadOrConfigure(auth, profileName, { ci }).pipe(
        Effect.flatMap((config) =>
          auth.read(profileName, config as StripeAuthConfig),
        ),
        Effect.map((creds) => ({
          apiKey: creds.secretKey,
          apiBaseUrl: creds.apiBaseUrl,
        })),
        Effect.mapError(
          (e) =>
            new AuthError({
              message: `Failed to resolve Stripe credentials for profile '${profileName}': ${(e as { message?: string }).message ?? String(e)}`,
              cause: e,
            }),
        ),
        Effect.orDie,
        Effect.cached,
      );
    }).pipe(Effect.orDie),
  );
