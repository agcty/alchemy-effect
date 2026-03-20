import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as esbuild from "esbuild";
import * as AdditionalModules from "../core/AdditionalModules.js";
import * as Bundler from "../core/Bundler.js";
import * as CloudflareInternal from "../core/CloudflareInternal.js";
import { BuildError, SystemError, ValidationError } from "../core/Error.js";
import * as Hash from "../core/Hash.js";
import { Module } from "../core/Module.js";
import * as NodeCompatWarning from "../core/NodeCompatWarning.js";
import { Output } from "../core/Output.js";
import * as Unenv from "../core/Unenv.js";
import type { Resolve } from "../core/Utils.js";

export const EsbuildBundler = Layer.effect(
  Bundler.Bundler,
  Effect.gen(function* () {
    const unenvFactory = yield* Unenv.Unenv;
    const cloudflareInternalFactory = yield* CloudflareInternal.CloudflareInternal;
    const additionalModulesFactory = yield* AdditionalModules.AdditionalModules;
    const nodeCompatWarningFactory = yield* NodeCompatWarning.NodeCompatWarning;
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;

    const makeResolver = <E = never>(
      build: esbuild.PluginBuild,
      handler: Resolve.Handler<E>,
    ): ((args: esbuild.OnResolveArgs) => Promise<Resolve.Result | undefined>) => {
      return (args) =>
        Effect.runPromise(
          handler(
            {
              path: args.path,
              directory: args.resolveDir,
              isRequire: args.kind === "require-call",
            },
            {
              resolve: () =>
                Effect.promise(() =>
                  build.resolve(args.path, {
                    resolveDir: args.resolveDir,
                    kind: args.kind,
                    pluginData: { skip: true },
                  }),
                ),
              outdir: build.initialOptions.outdir ?? "dist",
            },
          ),
        );
    };

    const makeEsbuildLoader =
      (fn: (path: string) => string | undefined) =>
      (args: esbuild.OnLoadArgs): esbuild.OnLoadResult => ({
        contents: fn(args.path),
        loader: "js",
      });

    const makeFindAdditionalModulesPlugin = Effect.fn(function* (input: Bundler.Options) {
      const findAdditionalModules = yield* additionalModulesFactory.create(
        input.cloudflare?.additionalModules,
        input.outDir ?? "dist",
      );
      const plugin = {
        name: "distilled-bundler/find-additional-modules" as const,
        setup: (build) => {
          build.onStart(() => {
            Effect.runSync(findAdditionalModules.start());
          });
          for (const resolver of findAdditionalModules.resolvers) {
            const resolverFn = makeResolver(build, resolver.resolve);
            build.onResolve({ filter: resolver.pattern }, async (args) => {
              // Avoid infinite loop if already calling from this plugin
              if (args.pluginData?.skip) return undefined;
              return await resolverFn(args);
            });
          }
        },
      } satisfies esbuild.Plugin;
      return {
        plugin,
        getModules: () => findAdditionalModules.end(),
      };
    });

    const makeCloudflareInternalPlugin = Effect.fn(function* (input: Bundler.Options) {
      const internal = yield* cloudflareInternalFactory.create({ format: input.format });
      const plugin = {
        name: "distilled-bundler/cloudflare-internal" as const,
        setup: (build) => {
          build.onStart(() => {
            Effect.runSync(internal.start());
          });
          const resolverFn = makeResolver(build, internal.resolve);
          build.onResolve({ filter: internal.pattern }, async (args) => {
            return await resolverFn(args);
          });
        },
      } satisfies esbuild.Plugin;
      return {
        plugin,
        getWarnings: () => internal.end(),
      };
    });

    const makeUnenvPlugin = Effect.fn(function* (input: Bundler.Options) {
      const unenv = yield* unenvFactory.create({
        compatibilityDate: input.cloudflare?.compatibilityDate ?? "2026-03-10",
        compatibilityFlags: input.cloudflare?.compatibilityFlags ?? [],
      });
      const plugin = {
        name: "distilled-bundler/unenv" as const,
        setup: (build) => {
          // --- Handler 1: Convert CJS require() of Node.js builtins to ESM ---
          build.onResolve(
            { filter: unenv.nodeBuiltIn.pattern },
            makeResolver(build, unenv.nodeBuiltIn.resolve),
          );
          build.onLoad(
            { filter: /.*/, namespace: unenv.nodeBuiltIn.namespace },
            makeEsbuildLoader(unenv.nodeBuiltIn.load),
          );
          // --- Handler 2: Resolve unenv aliases + externalize native modules ---
          if (unenv.unenvAlias) {
            build.onResolve(
              { filter: unenv.unenvAlias.pattern },
              makeResolver(build, unenv.unenvAlias.resolve),
            );
            build.onLoad(
              { filter: /.*/, namespace: unenv.unenvAlias.namespace },
              makeEsbuildLoader(unenv.unenvAlias.load),
            );
          }
          // --- Handler 3: Inject Node.js globals (process, Buffer, etc.) ---
          build.onResolve(
            { filter: unenv.nodeGlobals.pattern },
            makeResolver(build, unenv.nodeGlobals.resolve),
          );
          build.onLoad(
            { filter: /.*/, namespace: unenv.nodeGlobals.namespace },
            makeEsbuildLoader(unenv.nodeGlobals.load),
          );
        },
      } satisfies esbuild.Plugin;
      return {
        plugin,
      };
    });

    const makeNodeCompatPlugin = Effect.fn(function* (input: Bundler.Options) {
      if (
        input.cloudflare?.compatibilityFlags?.some(
          (flag) => flag === "nodejs_compat" || flag === "nodejs_compat_v2",
        )
      ) {
        return yield* makeUnenvPlugin(input);
      } else {
        // Without nodejs_compat, mark node:* imports as external but warn.
        // This matches wrangler's behavior: the build succeeds but the worker
        // may throw at runtime if it actually uses the node built-in.
        const nodeCompatWarning = yield* nodeCompatWarningFactory.create({ format: input.format });
        return {
          plugin: {
            name: "distilled-bundler/node-compat" as const,
            setup: (build) => {
              build.onStart(() => {
                Effect.runSync(nodeCompatWarning.start());
              });
              build.onResolve(
                { filter: nodeCompatWarning.pattern },
                makeResolver(build, nodeCompatWarning.resolve),
              );
            },
          } satisfies esbuild.Plugin,
          getWarning: () => nodeCompatWarning.getWarning(),
        };
      }
    });

    const extractMain = Effect.fn(function* (
      metafile: esbuild.Metafile,
      outDir: string,
      format: "esm" | "iife" = "esm",
    ) {
      const files: Array<string> = [];
      for (const [name, value] of Object.entries(metafile.outputs)) {
        if (value.entryPoint) {
          files.push(name);
        }
      }
      if (!files[0]) {
        return yield* new ValidationError({
          reason: "MissingEntrypoints",
          message: "No entry point found in metafile",
        });
      }
      if (files.length > 1) {
        return yield* new ValidationError({
          reason: "MultipleEntrypoints",
          message: `Multiple entry points found in metafile: ${files.join(", ")}`,
        });
      }
      const content = yield* fs.readFile(path.resolve(outDir, files[0])).pipe(
        Effect.mapError(
          (error) =>
            new SystemError({
              message: `Failed to read main entry point: ${error.message}`,
              cause: error,
            }),
        ),
      );
      return new Module({
        name: files[0],
        content,
        type: format === "esm" ? "ESModule" : "CommonJS",
        hash: Hash.hash(content),
      });
    });

    return Bundler.Bundler.of({
      build: Effect.fn(function* (options) {
        const nodeCompat = yield* makeNodeCompatPlugin(options);
        const findAdditionalModules = yield* makeFindAdditionalModulesPlugin(options);
        const cloudflareInternal = yield* makeCloudflareInternalPlugin(options);
        const outDir = options.outDir ?? "dist";
        const buildOptions = {
          // Common esbuild options matching wrangler's configuration.
          target: "es2024",
          conditions: ["workerd", "worker", "browser"],
          define: {
            "process.env.NODE_ENV": '"production"',
            "global.process.env.NODE_ENV": '"production"',
            "globalThis.process.env.NODE_ENV": '"production"',
            ...(options.cloudflare?.compatibilityDate &&
            options.cloudflare?.compatibilityDate >= "2022-03-21"
              ? { "navigator.userAgent": '"Cloudflare-Workers"' }
              : {}),
            ...options.define,
          },
          loader: {
            ".js": "jsx",
            ".mjs": "jsx",
            ".cjs": "jsx",
          },

          entryPoints: [options.main],
          bundle: true,
          absWorkingDir: options.rootDir,
          outdir: outDir,
          format: options.format ?? "esm",
          sourcemap: true,
          metafile: true,
          logLevel: "silent",
          external: ["__STATIC_CONTENT_MANIFEST", ...(options.external ?? [])],
          plugins: [nodeCompat.plugin, findAdditionalModules.plugin, cloudflareInternal.plugin],
          minify: options.minify,
          keepNames: options.keepNames ?? true,
          tsconfig: options.tsconfig
            ? path.resolve(options.rootDir ?? process.cwd(), options.tsconfig)
            : undefined,
        } satisfies esbuild.BuildOptions;
        const result = yield* runEsbuild(() => esbuild.build(buildOptions));
        const [main, additionalModules, warnings] = yield* Effect.all(
          [
            extractMain(result.metafile, outDir, options.format ?? "esm"),
            findAdditionalModules.getModules(),
            "getWarning" in nodeCompat ? nodeCompat.getWarning() : Effect.succeed(undefined),
          ],
          { concurrency: "unbounded" },
        );
        return new Output({
          directory: outDir,
          main: main.name,
          modules: [main, ...additionalModules],
          warnings: [
            ...result.warnings.map((warning) => warning.text),
            ...(warnings ? [warnings] : []),
          ],
          format: options.format ?? "esm",
        });
      }),
      watch: undefined!,
    });
  }),
);

const runEsbuild = <T>(fn: () => Promise<T>): Effect.Effect<T, BuildError> =>
  Effect.tryPromise({
    try: fn,
    catch: (cause) => {
      const error = cause as esbuild.BuildFailure;
      return new BuildError({
        message: error.message,
        errors: error.errors,
        warnings: error.warnings,
      });
    },
  });
