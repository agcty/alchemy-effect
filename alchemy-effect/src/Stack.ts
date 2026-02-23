import * as Effect from "effect/Effect";
import { FileSystem } from "effect/FileSystem";
import * as Layer from "effect/Layer";
import { Path } from "effect/Path";
import type { HttpClient } from "effect/unstable/http/HttpClient";
import type { Instance } from ".//Util/instance.ts";
import * as App from "./App.ts";
import { type AppliedPlan } from "./Apply.ts";
import type { CLI } from "./Cli/CLI.ts";
import { DotAlchemy } from "./Config.ts";
import type { DerivePlan, Providers, TraverseResources } from "./Plan.ts";
import type { Ref } from "./Ref.ts";
import type { Resource } from "./Resource.ts";
import type { StageConfig, Stages } from "./Stage.ts";
import * as State from "./State/index.ts";

export const defineStack = <
  const Name extends string,
  Resources extends Resource[],
  Req = never,
  Err = never,
>(
  stack: StackConfig<Name, Resources, Req, Err>,
): Stack<Name, Instance<Resources[number]>, Req, Err> => stack as any;

export type StackConfig<
  Name extends string,
  Resources extends Resource[] = Resource[],
  StagesReq = never,
  StagesErr = never,
  TapReq = never,
  TapErr = never,
> = {
  name: Name;
  stages: Stages<StagesReq, StagesErr>;
  resources: Resources;
  providers: Layer.Layer<
    Providers<Instance<Resources[number]>>,
    any,
    App.App | FileSystem | Path | DotAlchemy | HttpClient
  >;
  state?: Layer.Layer<State.State>;
  tap?: (
    output: StackOutput<Instance<Resources[number]>>,
  ) => Effect.Effect<any, TapErr, TapReq>;
} & (Exclude<NoInfer<StagesReq | TapReq>, BuiltInServices> extends never
  ? {
      layers?: never;
    }
  : {
      layers: Layer.Layer<
        Exclude<StagesReq | TapReq, BuiltInServices>,
        never,
        never
      >;
    });

export type StackOutput<Resources extends Resource> = AppliedPlan<
  DerivePlan<Resources>
>;

export type Stack<
  Name extends string = string,
  Resources extends Resource = any,
  StagesReq = any,
  StagesErr = any,
  TapReq = any,
  TapErr = any,
> = {
  name: Name;
  stages: Stages<StagesReq, StagesErr>;
  resources: Resources[];
  providers: Layer.Layer<Providers<Resources>, any, BuiltInServices>;
  state?: Layer.Layer<State.State>;
  cli?: Layer.Layer<CLI>;
  tap?: (output: StackOutput<Resources>) => Effect.Effect<void, TapErr, TapReq>;
} & (Exclude<StagesReq | TapReq, BuiltInServices> extends never
  ? {
      layers?: never;
    }
  : {
      layers: Layer.Layer<
        Exclude<StagesReq | TapReq, BuiltInServices>,
        never,
        never
      >;
    });

export type StackName<S extends Stack> =
  S extends Stack<infer Name, infer _> ? Name : never;

export type StackResources<S extends Stack> =
  S extends Stack<infer _, infer Resources> ? Resources : never;

export type BuiltInServices =
  | App.App
  | FileSystem
  | Path
  | DotAlchemy
  | HttpClient;

export interface StackRefConfig<S extends Stack> extends StageConfig {
  stack: S extends Stack<infer Name, any> ? Name : never;
  stage?: string;
}

export type StackRef<Resources extends Resource> = {
  [Id in keyof AsRecord<Resources>]: Ref<AsRecord<Resources>[Id]>;
};

type AsRecord<Resources extends Resource> = {
  [Id in TraverseResources<Resources>["id"]]: Extract<
    TraverseResources<Resources>,
    { id: Id }
  >;
};

export interface StackRefBuilders {
  [stage: string]: string | ((...args: any[]) => string);
}

export type StackRefs<S extends Stack> = {
  [stage in string]: StackRef<StackResources<S>>;
} & {
  as<Builders extends StackRefBuilders>(
    stages?: Builders,
  ): {
    [stage in Exclude<string, keyof Builders>]: StackRef<StackResources<S>>;
  } & {
    [builder in keyof Builders]: Builders[builder] extends string
      ? StackRef<StackResources<S>>
      : Builders[builder] extends (...args: infer Args) => any
        ? (...args: Args) => StackRef<StackResources<S>>
        : never;
  };
};
