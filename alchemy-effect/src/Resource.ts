import * as Effect from "effect/Effect";
import type * as Layer from "effect/Layer";
import type { Pipeable } from "effect/Pipeable";
import type { Input } from "./Input.ts";
import type { InstanceId } from "./InstanceId.ts";
import type * as Output from "./Output.ts";
import type { Provider, ProviderService } from "./Provider.ts";

export type ResourceCtor<R extends ResourceLike, Req = never> = (
  id: string,
  props?: R["props"],
) => Effect.Effect<R, never, Req>;

export type ResourceClass<Self extends ResourceLike> = ResourceCtor<
  Self,
  Provider<Self>
> &
  Effect.Effect<ResourceCtor<Self>> & {
    provider: ResourceProviders<Self, Self["props"]>;
  };

export interface ResourceLike<
  Base = any,
  Type extends string = any,
  Props extends object = any,
  Attributes extends object = any,
  Binding = any,
> extends Pipeable {
  kind: "Resource";
  type: Type;
  props: Props;
  attr: Attributes;
  base: Base;
  binding: Binding;
  /** @internal */
  Resource: unknown;
}

export type Resource<
  Self extends ResourceLike = any,
  Type extends string = any,
  Props extends object = any,
  Attributes extends object = any,
  Binding = never,
> = ResourceLike<Self, Type, Props, Attributes, Binding> & {
  bind(binding: Input<Binding>): Effect.Effect<void>;
} & {
  [attr in keyof Attributes]: Output.Output<Attributes[attr], never>;
};

export const Resource = <R extends ResourceLike>(
  type: R["type"],
): ResourceClass<R> => {
  const f = <const Id extends string, const P extends R["props"]>(
    id: Id,
    props?: P,
  ): Effect.Effect<
    (R & {
      id: Id;
      props: P;
    })["Resource"],
    never,
    Provider<R>
  > =>
    Effect.gen(function* () {
      //
    });

  const Service = Effect.gen(function* () {
    const services = yield* Effect.services();
    return (id: string, props: R["props"]) =>
      f(id, props).pipe(Effect.provide(services));
  });

  return Object.assign(f, Service);
};

export interface ResourceProviders<Resource extends ResourceLike, Props> {
  effect<
    Req = never,
    ReadReq = never,
    DiffReq = never,
    PrecreateReq = never,
    CreateReq = never,
    UpdateReq = never,
    DeleteReq = never,
  >(
    eff: Effect.Effect<
      ProviderService<
        Resource,
        ReadReq,
        DiffReq,
        PrecreateReq,
        CreateReq,
        UpdateReq,
        DeleteReq
      >,
      never,
      Req
    >,
  ): Layer.Layer<
    Provider<Resource>,
    never,
    Exclude<
      | Req
      | ReadReq
      | DiffReq
      | PrecreateReq
      | CreateReq
      | UpdateReq
      | DeleteReq,
      InstanceId
    >
  >;
  of: <
    ReadReq = never,
    DiffReq = never,
    PrecreateReq = never,
    CreateReq = never,
    UpdateReq = never,
    DeleteReq = never,
  >(
    service: ProviderService<
      Resource,
      ReadReq,
      DiffReq,
      PrecreateReq,
      CreateReq,
      UpdateReq,
      DeleteReq
    >,
  ) => ProviderService<
    Resource,
    ReadReq,
    DiffReq,
    PrecreateReq,
    CreateReq,
    UpdateReq,
    DeleteReq
  >;
}
