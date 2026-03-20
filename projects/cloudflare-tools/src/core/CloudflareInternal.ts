import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableHashSet from "effect/MutableHashSet";
import * as ServiceMap from "effect/ServiceMap";
import type { Resolve } from "./Utils.js";

export declare namespace CloudflareInternal {
  interface Options {
    readonly format?: "esm" | "iife";
  }
  interface Result {
    readonly pattern: RegExp;
    readonly start: () => Effect.Effect<void>;
    readonly resolve: Resolve.Handler;
    readonly end: () => Effect.Effect<string | undefined>;
  }
}

export class CloudflareInternal extends ServiceMap.Service<
  CloudflareInternal,
  {
    readonly create: (
      options: CloudflareInternal.Options,
    ) => Effect.Effect<CloudflareInternal.Result>;
  }
>()("distilled-bundler/CloudflareInternal") {}

export const layer = Layer.effect(
  CloudflareInternal,
  Effect.gen(function* () {
    return CloudflareInternal.of({
      create: Effect.fn(function* ({ format = "esm" }) {
        const paths = MutableHashSet.make<ReadonlyArray<string>>();
        return {
          pattern: /^cloudflare:.*/,
          start: () => Effect.sync(() => MutableHashSet.clear(paths)),
          resolve: Effect.fn(function* (args) {
            MutableHashSet.add(paths, args.path);
            return { external: true };
          }),
          end: Effect.fn(function* () {
            if (format === "iife" && MutableHashSet.size(paths) > 0) {
              const pathList = Array.from(paths)
                .map((path) => `"${path}"`)
                .sort()
                .join(", ");
              return (
                `Unexpected external import of ${pathList}. ` +
                `Your worker has no default export, which means it is assumed to be a Service Worker format Worker. ` +
                `Did you mean to create a ES Module format Worker? ` +
                `If so, try adding \`export default { ... }\` in your entry-point. ` +
                `See https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/.`
              );
            }
          }),
        };
      }),
    });
  }),
);
