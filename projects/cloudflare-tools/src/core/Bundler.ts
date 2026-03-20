import type * as Effect from "effect/Effect";
import type * as Result from "effect/Result";
import type * as Scope from "effect/Scope";
import * as ServiceMap from "effect/ServiceMap";
import type * as Stream from "effect/Stream";
import type { AdditionalModules } from "./AdditionalModules.js";
import type { BundleError } from "./Error.js";
import type { Output } from "./Output.js";

export interface Options {
  /** The absolute or relative path to the entry point. */
  readonly main: string;
  /** The path to the root of the project. @default process.cwd() */
  readonly rootDir?: string;
  /** The module format of the entry point. @default "esm" */
  readonly format?: "esm" | "iife";
  /** The path to the output directory. @default "dist" */
  readonly outDir?: string;
  /** Whether to minify the bundle. @default false */
  readonly minify?: boolean;
  /** Whether to keep the names of the variables in the bundle. @default true */
  readonly keepNames?: boolean;
  /** The path to the external modules. @default [] */
  readonly external?: ReadonlyArray<string>;
  /** The define variables for the bundle. */
  readonly define?: Record<string, string>;
  /** The path to the tsconfig.json file. */
  readonly tsconfig?: string;
  /**
   * Cloudflare-specific options for bundling.
   * Note that these options - especially the `compatibilityDate` and `compatibilityFlags` - are used to influence bundling options (e.g. polyfills for Node.js APIs).
   */
  readonly cloudflare?: Cloudflare;
}

/**
 * Represents Cloudflare-specific options for the bundler.
 * Note that these options - especially the `compatibilityDate` and `compatibilityFlags` - are used to influence bundling options (e.g. polyfills for Node.js APIs).
 */
export interface Cloudflare {
  /** Cloudflare Workers compatibility date (defaults to "2026-03-10") */
  readonly compatibilityDate?: string;
  /** Cloudflare Workers compatibility flags (e.g., ["nodejs_compat"]) (defaults to []) */
  readonly compatibilityFlags?: ReadonlyArray<string>;
  /** Defines rules for handling additional, non-JS/TS modules in your bundle. */
  readonly additionalModules?: AdditionalModules.Options;
}

/**
 * Defines the common interface for all bundlers.
 */
export class Bundler extends ServiceMap.Service<
  Bundler,
  {
    /**
     * Builds a single bundle with the given options.
     * @param options - The options for the build.
     * @returns The built bundle.
     * @throws A BundleError if the build fails.
     */
    readonly build: (options: Options) => Effect.Effect<Output, BundleError>;
    /**
     * Watches the bundle for changes and rebuilds it when changes are detected.
     * The stream will emit a new result whenever the bundle is rebuilt.
     * @param options - The options for the watch.
     * @returns A stream of build results, wrapped in a Result that contains either a bundle or an error.
     * @throws A BundleError only if the bundler fails to initialize. Any build-specific errors will be included in the Result stream.
     */
    readonly watch: (
      options: Options,
    ) => Stream.Stream<Result.Result<Output, BundleError>, BundleError, Scope.Scope>;
  }
>()("distilled-bundler/Bundler") {}
