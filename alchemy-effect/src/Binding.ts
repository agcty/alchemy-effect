import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ServiceMap from "effect/ServiceMap";
import type { Input } from "./Input.ts";
import type { ResourceClass, ResourceLike } from "./Resource.ts";
import type { Instance } from "./Util/instance.ts";

export interface Binding<
  Tag extends string = string,
  R extends ResourceLike = ResourceLike,
  Props = any,
> {
  tag: Tag;
  resource: R;
  props: Props;
  bind<Self>(
    this: Self,
    to: R,
    props: Props,
  ): Effect.Effect<void, never, Instance<Self>>;
  new (): Binding<Tag, R, Props>;
}

export const Policy =
  <R extends ResourceLike, Props = never>() =>
  <Tag extends string>(tag: Tag): Binding<Tag, R, Props> =>
    class {
      static readonly type = tag;
      static bind(resource: R): Effect.Effect<void> {
        return Effect.succeed(undefined);
      }
    } as any;

export const effect = <
  B extends Binding,
  R extends ResourceClass,
  Err = never,
  Req = never,
>(
  [resource, binding]: [R, B],
  impl: NoInfer<
    (
      self: ResourceClass.Instance<R>,
      binding: B["resource"],
      props: B["props"],
    ) => Effect.Effect<
      {
        [prop in keyof R["fn"]]?: Input<R["fn"][prop]>;
      },
      Err,
      Req
    >
  >,
): Layer.Layer<[ResourceClass.Instance<R>, B["resource"]], Err, Req> =>
  Layer.succeed(BindingService(resource, binding), impl);

export const succeed = <R extends ResourceClass, B extends Binding>(
  [resource, binding]: [R, B],
  impl: NoInfer<
    (
      self: ResourceClass.Instance<R>,
      binding: B["resource"],
      props: B["props"],
      // ...props: never extends B["props"] ? [] : [props: B["props"]]
    ) => {
      [prop in keyof R["fn"]]?: Input<R["fn"][prop]>;
    }
  >,
): Layer.Layer<[ResourceClass.Instance<R>, B["resource"]]> =>
  Layer.succeed(BindingService(resource, binding), impl);

const BindingService = <R extends ResourceClass, B extends Binding>(
  resource: R,
  binding: B,
) =>
  ServiceMap.Service<[ResourceClass.Instance<R>, B["resource"]], any>()(
    `${resource.type}(${binding.tag})`,
  );
