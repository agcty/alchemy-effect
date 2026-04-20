import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export class AuthError extends Schema.TaggedErrorClass<AuthError>()(
  "AuthError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export class AuthProviders extends Context.Service<
  AuthProviders,
  {
    [providerName: string]: AuthProvider;
  }
>()("AuthProviders") {}

export interface AuthProviderImpl<
  Config extends { method: string } = any,
  Credentials = any,
  ConfigureReq = any,
  LoginReq = any,
  LogoutReq = any,
  PrettyPrintReq = any,
  ReadReq = any,
> {
  configure(
    profileName: string,
  ): Effect.Effect<Config, AuthError, ConfigureReq>;

  login(
    profileName: string,
    config: Config,
  ): Effect.Effect<void, AuthError, LoginReq>;

  logout(
    profileName: string,
    config: Config,
  ): Effect.Effect<void, AuthError, LogoutReq>;

  prettyPrint(
    profileName: string,
    config: Config,
  ): Effect.Effect<void, AuthError, PrettyPrintReq>;

  read(
    profileName: string,
    config: Config,
  ): Effect.Effect<Credentials, AuthError, ReadReq>;
}

export interface AuthProvider<
  Config extends { method: string } = any,
  Credentials = any,
> extends AuthProviderImpl<
  Config,
  Credentials,
  never,
  never,
  never,
  never,
  never
> {
  readonly kind: "AuthProvider";
  readonly name: string;
}

export const AuthProvider =
  <Config extends { method: string }, Credentials>() =>
  <
    ImplReq = never,
    ConfigureReq = never,
    LoginReq = never,
    LogoutReq = never,
    PrettyPrintReq = never,
    ReadReq = never,
  >(
    name: string,
    impl:
      | AuthProviderImpl<
          Config,
          Credentials,
          ConfigureReq,
          LoginReq,
          LogoutReq,
          PrettyPrintReq,
          ReadReq
        >
      | Effect.Effect<
          AuthProviderImpl<
            Config,
            Credentials,
            ConfigureReq,
            LoginReq,
            LogoutReq,
            PrettyPrintReq,
            ReadReq
          >,
          never,
          ImplReq
        >,
  ) =>
    Effect.gen(function* () {
      const ctx = yield* Effect.context();
      const providers = yield* AuthProviders;
      const service = yield* Effect.isEffect(impl)
        ? impl
        : Effect.succeed(impl);
      return yield* Effect.sync(
        () =>
          (providers[name] = {
            kind: "AuthProvider",
            name,
            ...Object.fromEntries(
              Object.entries(service).map(([name, fn]) => [
                name,
                (...args: Parameters<typeof fn>) =>
                  fn(...args).pipe(Effect.provideContext(ctx)),
              ]),
            ),
          } as AuthProvider<Config, Credentials>),
      );
    });
