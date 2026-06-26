import { DEFAULT_API_BASE_URL } from "@distilled.cloud/stripe/Credentials";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Redacted from "effect/Redacted";
import {
  AuthError,
  AuthProviderLayer,
  type ConfigureContext,
} from "../Auth/AuthProvider.ts";
import { CredentialsStore, displayRedacted } from "../Auth/Credentials.ts";
import { getEnv, getEnvRedacted, retryOnce } from "../Auth/Env.ts";
import * as Clank from "../Util/Clank.ts";

const STORAGE_KEY = "stripe-stored";

export const STRIPE_AUTH_PROVIDER_NAME = "Stripe";

export type StripeAuthConfig = { method: "env" } | { method: "stored" };

export interface StripeStoredCredentials {
  readonly secretKey: string;
  readonly apiBaseUrl?: string;
}

export interface StripeResolvedCredentials {
  readonly secretKey: Redacted.Redacted<string>;
  readonly apiBaseUrl: string;
  readonly source: { readonly type: StripeAuthConfig["method"] };
}

const authOptions: Array<{
  readonly value: StripeAuthConfig["method"];
  readonly label: string;
  readonly hint?: string;
}> = [
  {
    value: "env",
    label: "Environment Variables",
    hint: "STRIPE_SECRET_KEY + optional STRIPE_API_BASE_URL",
  },
  {
    value: "stored",
    label: "Secret Key",
    hint: "enter a Stripe secret key interactively, stored in ~/.alchemy/credentials",
  },
];

export const StripeAuth = AuthProviderLayer<
  StripeAuthConfig,
  StripeResolvedCredentials
>()(
  STRIPE_AUTH_PROVIDER_NAME,
  Effect.gen(function* () {
    const store = yield* CredentialsStore;

    const loginStored = Effect.fnUntraced(function* (profileName: string) {
      const envBaseUrl = yield* getEnv("STRIPE_API_BASE_URL");
      const secretKey = yield* Clank.password({
        message: "Stripe Secret Key",
        validate: (v) => (v.length === 0 ? "Required" : undefined),
      }).pipe(retryOnce);

      const apiBaseUrl = yield* Clank.text({
        message: "Stripe API Base URL (Enter for default)",
        placeholder: envBaseUrl ?? DEFAULT_API_BASE_URL,
        defaultValue: envBaseUrl ?? DEFAULT_API_BASE_URL,
      }).pipe(retryOnce);

      yield* store.write<StripeStoredCredentials>(profileName, STORAGE_KEY, {
        secretKey,
        apiBaseUrl: apiBaseUrl.length > 0 ? apiBaseUrl : DEFAULT_API_BASE_URL,
      });
      yield* Clank.success("Stripe: credentials saved.");
      return { method: "stored" as const };
    });

    const configureCredentials = (profileName: string, ctx: ConfigureContext) =>
      Effect.gen(function* () {
        if (ctx.ci) {
          return { method: "env" as const };
        }
        const method = yield* Clank.select({
          message: "Stripe authentication method",
          options: authOptions,
        }).pipe(retryOnce);
        return yield* Match.value(method).pipe(
          Match.when("env", () => Effect.succeed({ method: "env" as const })),
          Match.when("stored", () => loginStored(profileName)),
          Match.exhaustive,
        );
      }).pipe(
        Effect.mapError(
          (e) =>
            new AuthError({
              message: "failed to configure credentials",
              cause: e,
            }),
        ),
      );

    const resolveCredentials = (
      profileName: string,
      config: StripeAuthConfig,
    ): Effect.Effect<StripeResolvedCredentials, AuthError> =>
      Match.value(config).pipe(
        Match.when(
          { method: "env" },
          Effect.fnUntraced(function* () {
            const secretKey = yield* getEnvRedacted("STRIPE_SECRET_KEY");
            if (!secretKey) {
              return yield* new AuthError({
                message:
                  "Stripe env credentials not found. Set STRIPE_SECRET_KEY.",
              });
            }
            const apiBaseUrl =
              (yield* getEnv("STRIPE_API_BASE_URL")) ?? DEFAULT_API_BASE_URL;
            return {
              secretKey,
              apiBaseUrl,
              source: { type: "env" as const },
            };
          }),
        ),
        Match.when({ method: "stored" }, () =>
          store.read<StripeStoredCredentials>(profileName, STORAGE_KEY).pipe(
            Effect.flatMap((creds) =>
              creds == null
                ? Effect.fail(
                    new AuthError({
                      message:
                        "Stripe stored credentials not found. Run: alchemy login --configure",
                    }),
                  )
                : Effect.succeed({
                    secretKey: Redacted.make(creds.secretKey),
                    apiBaseUrl: creds.apiBaseUrl ?? DEFAULT_API_BASE_URL,
                    source: { type: "stored" as const },
                  }),
            ),
          ),
        ),
        Match.exhaustive,
      );

    const logout = (profileName: string, config: StripeAuthConfig) =>
      Match.value(config).pipe(
        Match.when({ method: "env" }, () => Effect.void),
        Match.when({ method: "stored" }, () =>
          store
            .delete(profileName, STORAGE_KEY)
            .pipe(
              Effect.andThen(
                Clank.success("Stripe: stored credentials removed"),
              ),
            ),
        ),
        Match.exhaustive,
      );

    const login = (profileName: string, config: StripeAuthConfig) =>
      Match.value(config)
        .pipe(
          Match.when({ method: "env" }, () => Effect.void),
          Match.when({ method: "stored" }, () =>
            store
              .read<StripeStoredCredentials>(profileName, STORAGE_KEY)
              .pipe(
                Effect.flatMap((creds) =>
                  creds == null ? loginStored(profileName) : Effect.void,
                ),
              ),
          ),
          Match.exhaustive,
        )
        .pipe(
          Effect.mapError(
            (e) => new AuthError({ message: "login failed", cause: e }),
          ),
        );

    const prettyPrint = (profileName: string, config: StripeAuthConfig) =>
      resolveCredentials(profileName, config).pipe(
        Effect.tap((creds) =>
          Effect.all([
            Console.log(`  secretKey: ${displayRedacted(creds.secretKey, 9)}`),
            Console.log(`  apiBaseUrl: ${creds.apiBaseUrl}`),
            Console.log(`  source: ${creds.source.type}`),
          ]),
        ),
        Effect.catch((e) =>
          Console.error(`  Failed to retrieve credentials: ${e}`),
        ),
      );

    return {
      configure: configureCredentials,
      logout,
      login,
      prettyPrint,
      read: resolveCredentials,
    };
  }),
);
