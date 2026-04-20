import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { AlchemyConfig } from "../Auth/Profile.ts";
import {
  CloudflareAuth,
  type CloudflareAuthConfig,
  type CloudflareResolvedCredentials,
} from "./Auth/AuthProvider.ts";

const ALCHEMY_PROFILE = Config.string("ALCHEMY_PROFILE").pipe(
  Config.withDefault("default"),
);

export class CloudflareEnvironment extends Context.Service<
  CloudflareEnvironment,
  CloudflareResolvedCredentials
>()("Cloudflare::CloudflareEnvironment") {}

const CLOUDFLARE_ACCOUNT_ID = Config.string("CLOUDFLARE_ACCOUNT_ID");

export const fromEnv = () =>
  Layer.effect(
    CloudflareEnvironment,
    Effect.gen(function* () {
      const accountId = yield* CLOUDFLARE_ACCOUNT_ID.pipe(
        Config.option,
        Config.map(Option.getOrUndefined),
      );
      return { account: accountId } as any;
    }),
  );

export const fromProfile = () =>
  Layer.effect(
    CloudflareEnvironment,
    Effect.gen(function* () {
      const auth = yield* CloudflareAuth;
      const config = yield* AlchemyConfig;
      const profileName = yield* ALCHEMY_PROFILE;
      const cloudflareConfig = config.profiles[profileName]?.["cloudflare"] as
        | CloudflareAuthConfig
        | undefined;

      return yield* auth.read(
        profileName,
        cloudflareConfig ?? (yield* auth.configure(profileName)),
      );
    }),
  );
