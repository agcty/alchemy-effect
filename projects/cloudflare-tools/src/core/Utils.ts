import type * as Effect from "effect/Effect";

export declare namespace Resolve {
  interface Args {
    readonly path: string;
    readonly directory: string;
    readonly isRequire: boolean;
  }
  interface Result {
    readonly path?: string;
    readonly namespace?: string;
    readonly external?: boolean;
    readonly watchFiles?: Array<string>;
  }
  interface Context {
    readonly resolve: Resolve.Handler;
    readonly outdir: string;
  }
  type Handler<E = never> = (args: Args, context: Context) => Effect.Effect<Result | undefined, E>;
}
