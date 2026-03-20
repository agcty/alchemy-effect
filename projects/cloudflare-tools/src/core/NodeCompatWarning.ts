import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ServiceMap from "effect/ServiceMap";
import type { Resolve } from "./Utils.js";

export declare namespace NodeCompatWarning {
  interface Options {
    readonly format?: "esm" | "iife";
  }
  interface Result {
    readonly start: () => Effect.Effect<void>;
    readonly pattern: RegExp;
    readonly resolve: Resolve.Handler;
    readonly getWarning: () => Effect.Effect<string | undefined>;
  }
}

export class NodeCompatWarning extends ServiceMap.Service<
  NodeCompatWarning,
  {
    readonly create: (
      options: NodeCompatWarning.Options,
    ) => Effect.Effect<NodeCompatWarning.Result>;
  }
>()("distilled-bundler/NodeCompatWarning") {}

export const layer = Layer.succeed(
  NodeCompatWarning,
  NodeCompatWarning.of({
    create: ({ format = "esm" }) =>
      Effect.sync((): NodeCompatWarning.Result => {
        const imports = new Set<string>();
        return {
          start: () => Effect.sync(() => imports.clear()),
          pattern: /^node:/,
          resolve: (args) =>
            Effect.sync(() => {
              return { path: args.path, external: true };
            }),
          getWarning: () =>
            Effect.sync(() => {
              if (format === "iife" && imports.size > 0) {
                return `Unexpected external import of ${Array.from(imports).join(", ")}.`;
              }
            }),
        };
      }),
  }),
);
