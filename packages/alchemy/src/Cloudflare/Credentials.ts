import {
  apiKeyCredentials,
  apiTokenCredentials,
  Credentials,
  oauthCredentials,
} from "@distilled.cloud/cloudflare/Credentials";
import { ConfigError } from "@distilled.cloud/core/errors";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Redacted from "effect/Redacted";
import { loadOrConfigure } from "../Auth/Profile.ts";
import {
  CloudflareAuth,
  type CloudflareAuthConfig,
} from "./Auth/AuthProvider.ts";

export { Credentials, fromEnv } from "@distilled.cloud/cloudflare/Credentials";

/**
 * Build a `Credentials` layer that resolves Cloudflare credentials via the
 * Alchemy AuthProvider using the configured profile (defaults to "default",
 * overridable with the `ALCHEMY_PROFILE` env/config value).
 */
export const fromAuthProvider = () =>
  Layer.effect(
    Credentials,
    Effect.gen(function* () {
      const auth = yield* CloudflareAuth;
      const profileName = yield* Config.string("ALCHEMY_PROFILE").pipe(
        Config.withDefault("default"),
      );
      const ctx = yield* Effect.context<never>();

      return loadOrConfigure(auth, profileName).pipe(
        Effect.flatMap((config) =>
          auth.read(profileName, config as CloudflareAuthConfig),
        ),
        Effect.map((creds) =>
          Match.value(creds).pipe(
            Match.when({ type: "apiToken" }, (c) =>
              apiTokenCredentials({
                apiToken: Redacted.value(c.apiToken),
              }),
            ),
            Match.when({ type: "apiKey" }, (c) =>
              apiKeyCredentials({
                apiKey: Redacted.value(c.apiKey),
                email: Redacted.value(c.email),
              }),
            ),
            Match.when({ type: "oauth" }, (c) =>
              oauthCredentials({
                accessToken: Redacted.value(c.accessToken),
                expiresAt: c.expires,
              }),
            ),
            Match.exhaustive,
          ),
        ),
        Effect.mapError(
          (e) =>
            new ConfigError({
              message: `Failed to resolve Cloudflare credentials for profile '${profileName}': ${(e as { message?: string }).message ?? String(e)}`,
            }),
        ),
        Effect.provide(ctx),
      );
    }),
  );
