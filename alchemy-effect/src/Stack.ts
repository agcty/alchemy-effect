import * as Effect from "effect/Effect";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import * as ServiceMap from "effect/ServiceMap";
import type { HttpClient } from "effect/unstable/http/HttpClient";
import { DotAlchemy } from "./Config.ts";
import type { ResourceLike } from "./Resource.ts";
import type { Stage } from "./Stage.ts";

export class StackName extends ServiceMap.Service<StackName, string>()(
  "StackName",
) {}

export type StackServices =
  | StackName
  | Stage
  | FileSystem
  | Path
  | DotAlchemy
  | HttpClient;

export type Stack<
  Name extends string = string,
  Resources = any,
  Output = any,
> = {
  name: Name;
  output: Output;
  resources: Resources;
};

export const make: {
  <const Name extends string>(
    name: Name,
  ): <A, Err = never, Req extends StackServices | ResourceLike = never>(
    eff: Effect.Effect<A, Err, Req>,
  ) => Effect.Effect<
    Stack<
      Name,
      {
        [type in keyof ExtractResources<Req>]: ExtractResources<Req>[type];
      },
      A
    >,
    Err,
    Exclude<Req, ResourceLike>
  >;
  <
    const Name extends string,
    A,
    Err = never,
    Req extends StackServices | ResourceLike = never,
  >(
    name: Name,
    eff: Effect.Effect<A, Err, Req>,
  ): Effect.Effect<
    Stack<
      Name,
      {
        [type in keyof ExtractResources<Req>]: ExtractResources<Req>[type];
      },
      A
    >,
    Err,
    Exclude<Req, ResourceLike>
  >;
} = undefined!;

type ExtractResources<T> = AsRecord<Extract<T, ResourceLike>>;

type AsRecord<T extends ResourceLike> = {
  [id in T["id"]]: Extract<T, { id: id }>;
};
