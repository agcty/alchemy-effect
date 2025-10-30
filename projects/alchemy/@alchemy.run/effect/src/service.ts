import type { Resource } from "./resource.ts";
import type { Runtime, RuntimeHandler, RuntimeProps } from "./runtime.ts";

export interface Service<
  ID extends string = string,
  F extends Runtime = Runtime,
  Handler extends RuntimeHandler = RuntimeHandler,
  Props extends RuntimeProps<F, any> = RuntimeProps<F, any>,
  Attr = (F & { props: Props })["attr"],
> extends Resource<F["type"], ID, Props, Attr> {
  id: ID;
  runtime: F;
  handler: Handler;
  props: Props;
  attr: Attr;
}
