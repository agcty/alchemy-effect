import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Queue from "effect/Queue";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";
import {
  rolldown,
  type InputOptions,
  type OutputAsset,
  type OutputChunk,
  type OutputOptions,
  type Plugin,
  watch,
} from "rolldown";
import {
  Bundle,
  type BundleResult,
  type CloudflareOptions,
  writeAdditionalModules,
} from "../bundle.js";
import { deriveDefines, deriveFormat } from "../cloudflare-defaults.js";
import { BuildError, type BundleError } from "../errors.js";
import type { Module } from "../module.js";
import { cloudflareInternalPlugin } from "./plugins/cloudflare-internal.js";
import { createModuleCollector } from "./plugins/module-collector.js";
import { createNodejsCompat } from "./plugins/nodejs-compat.js";
import { nodejsCompatWarningPlugin } from "./plugins/nodejs-compat-warning.js";

export type RolldownBundleOptions = CloudflareOptions;

export const RolldownBundleLive = Layer.effect(
  Bundle,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const makeBuildOptions = Effect.fn(function* (options: CloudflareOptions) {
      const plugins: Array<Plugin> = [];
      const moduleCollector = createModuleCollector({
        rules: options.rules,
        preserveFileNames: options.preserveFileNames,
      });
      plugins.push(moduleCollector.plugin);

      let alias: Record<string, string> = {};
      let inject: Record<string, string | [string, string]> | undefined;

      if (
        options.compatibilityFlags?.some(
          (flag) => flag === "nodejs_compat" || flag === "nodejs_compat_v2",
        )
      ) {
        const compat = yield* Effect.promise(() =>
          createNodejsCompat({
            compatibilityDate: options.compatibilityDate,
            compatibilityFlags: options.compatibilityFlags,
          }),
        );
        plugins.push(compat.plugin);
        alias = compat.alias;
        inject = compat.transform.inject;
      } else {
        plugins.push(nodejsCompatWarningPlugin());
      }

      plugins.push(cloudflareInternalPlugin());

      const input = yield* scanAdditionalEntries({
        options,
        fs,
        path,
      }).pipe(Effect.mapError(mapRolldownError));

      const inputOptions = {
        input,
        cwd: options.projectRoot,
        platform: "browser",
        plugins,
        external: (id) => {
          if (id === "__STATIC_CONTENT_MANIFEST") return true;
          return options.external?.includes(id) === true;
        },
        resolve: {
          alias,
          conditionNames: ["workerd", "worker", "browser", "import", "default"],
        },
        moduleTypes: {
          ".js": "jsx",
          ".mjs": "jsx",
          ".cjs": "jsx",
        },
        transform: {
          define: deriveDefines(options),
          ...(inject ? { inject } : {}),
        },
        tsconfig: options.tsconfig ? path.resolve(options.projectRoot, options.tsconfig) : true,
      } satisfies InputOptions;

      const outputOptions = {
        dir: options.outputDir,
        format: deriveFormat(options.format),
        sourcemap: true,
        minify: options.minify ?? false,
        entryFileNames: "[name].js",
        chunkFileNames: "[name]-[hash].js",
        codeSplitting: options.findAdditionalModules ? true : false,
        keepNames: options.keepNames ?? true,
      } satisfies OutputOptions;

      return { inputOptions, outputOptions, moduleCollector };
    });

    return Bundle.of({
      build: Effect.fn(function* (options) {
        const { inputOptions, outputOptions, moduleCollector } = yield* makeBuildOptions(options);
        const bundle = yield* Effect.tryPromise({
          try: () => rolldown(inputOptions),
          catch: mapRolldownError,
        });

        try {
          const output = yield* Effect.tryPromise({
            try: () => bundle.write(outputOptions),
            catch: mapRolldownError,
          });
          return yield* mapBuildResult({
            options,
            output,
            moduleCollector,
            path,
            fs,
          });
        } finally {
          yield* Effect.promise(() => bundle.close()).pipe(Effect.ignore);
        }
      }),
      watch: (options) =>
        Stream.callback<Result.Result<BundleResult, BundleError>, never>((queue) =>
          Effect.gen(function* () {
            const { inputOptions, outputOptions, moduleCollector } = yield* makeBuildOptions(options);
            const watcher = watch({
              ...inputOptions,
              output: outputOptions,
              watch: {},
              experimental: {
                incrementalBuild: true,
              },
            });

            watcher.on("event", async (event) => {
              if (event.code === "BUNDLE_END") {
                try {
                  const result = await Effect.runPromise(
                    mapWatchResult({
                      options,
                      moduleCollector,
                      path,
                      fs,
                    }),
                  );
                  Queue.offerUnsafe(queue, Result.succeed(result));
                } catch (error) {
                  Queue.offerUnsafe(queue, Result.fail(mapRolldownError(error)));
                } finally {
                  await event.result.close();
                }
              } else if (event.code === "ERROR") {
                Queue.offerUnsafe(queue, Result.fail(mapRolldownError(event.error)));
                await event.result.close();
              }
            });

            return yield* Effect.addFinalizer(() =>
              Effect.promise(() => watcher.close()).pipe(Effect.ignore),
            );
          }).pipe(
            Effect.catch((error) => Queue.offer(queue, Result.fail(error)).pipe(Effect.asVoid)),
          ),
        ),
    });
  }),
);

const mapBuildResult = Effect.fn(function* ({
  options,
  output,
  moduleCollector,
  path,
  fs,
}: {
  readonly options: CloudflareOptions;
  readonly output: Awaited<ReturnType<Awaited<ReturnType<typeof rolldown>>["write"]>>;
  readonly moduleCollector: ReturnType<typeof createModuleCollector>;
  readonly path: Path.Path;
  readonly fs: FileSystem.FileSystem;
}) {
  const entryChunk = output.output.find(
    (item): item is OutputChunk => item.type === "chunk" && item.isEntry,
  );
  if (!entryChunk) {
    return yield* new BuildError({
      message: "Build failed to produce an entry chunk.",
      errors: [],
      warnings: [],
    });
  }

  const resolvedEntryPoint = path.resolve(options.outputDir, entryChunk.fileName);
  const copiedModules = moduleCollector.getModules();
  const emittedModules = getEmittedOutputModules({
    output,
    path,
    outputDir: options.outputDir,
    main: resolvedEntryPoint,
  });
  const modules = [...emittedModules, ...copiedModules];

  if (copiedModules.length > 0) {
    yield* writeAdditionalModules(copiedModules, path.dirname(resolvedEntryPoint)).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path),
    );
  }

  return {
    main: resolvedEntryPoint,
    modules,
    type: entryChunk.exports.length > 0 ? "esm" : "commonjs",
    outputDir: options.outputDir,
  } satisfies BundleResult;
});

const mapWatchResult = Effect.fn(function* ({
  options,
  moduleCollector,
  path,
  fs,
}: {
  readonly options: CloudflareOptions;
  readonly moduleCollector: ReturnType<typeof createModuleCollector>;
  readonly path: Path.Path;
  readonly fs: FileSystem.FileSystem;
}) {
  const entryFile = `${path.basename(options.main, path.extname(options.main))}.js`;
  const resolvedEntryPoint = path.resolve(options.outputDir, entryFile);
  const stat = yield* fs.stat(resolvedEntryPoint).pipe(
    Effect.mapError(() =>
      new BuildError({
        message: `Build failed to produce an entry chunk at "${resolvedEntryPoint}".`,
        errors: [],
        warnings: [],
      }),
    ),
  );
  if (stat.type !== "File") {
    return yield* new BuildError({
      message: `Expected "${resolvedEntryPoint}" to be a file.`,
      errors: [],
      warnings: [],
    });
  }

  const code = yield* fs.readFileString(resolvedEntryPoint).pipe(
    Effect.mapError(() =>
      new BuildError({
        message: `Failed to read entry chunk at "${resolvedEntryPoint}".`,
        errors: [],
        warnings: [],
      }),
    ),
  );

  const copiedModules = moduleCollector.getModules();
  if (copiedModules.length > 0) {
    yield* writeAdditionalModules(copiedModules, path.dirname(resolvedEntryPoint)).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path),
    );
  }

  const emittedModules = yield* readEmittedOutputModules({
    fs,
    path,
    outputDir: options.outputDir,
    main: resolvedEntryPoint,
  }).pipe(Effect.mapError(mapRolldownError));
  const modules = [...emittedModules, ...copiedModules];

  return {
    main: resolvedEntryPoint,
    modules,
    type: /\bexport[\s{]/.test(code) ? "esm" : "commonjs",
    outputDir: options.outputDir,
  } satisfies BundleResult;
});

const mapRolldownError = (cause: unknown): BuildError =>
  new BuildError({
    message: cause instanceof Error ? cause.message : String(cause),
    errors: [],
    warnings: [],
  });

const getEmittedOutputModules = ({
  output,
  path,
  outputDir,
  main,
}: {
  readonly output: Awaited<ReturnType<Awaited<ReturnType<typeof rolldown>>["write"]>>;
  readonly path: Path.Path;
  readonly outputDir: string;
  readonly main: string;
}): Array<Module> =>
  output.output.flatMap((item) => {
    if (!isEmittedCodeModule(item, main, path, outputDir)) {
      return [];
    }

    return [
      {
        name: item.fileName,
        path: path.resolve(outputDir, item.fileName),
        content: Buffer.from(item.code),
        type: item.fileName.endsWith(".cjs") ? "CommonJS" : "ESModule",
      } satisfies Module,
    ];
  });

const readEmittedOutputModules = Effect.fn(function* ({
  fs,
  path,
  outputDir,
  main,
}: {
  readonly fs: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly outputDir: string;
  readonly main: string;
}) {
  const modules: Array<Module> = [];

  const visit: (directory: string) => Effect.Effect<void, unknown> = (directory) =>
    fs.readDirectory(directory).pipe(
      Effect.flatMap((names) =>
        Effect.forEach(
          names,
          (name) => {
            const filePath = path.join(directory, name);
            return fs.stat(filePath).pipe(
              Effect.flatMap((stat) => {
                if (stat.type === "Directory") {
                  return visit(filePath);
                }

                if (!isEmittedCodeFile(filePath, main)) {
                  return Effect.void;
                }

                return fs.readFile(filePath).pipe(
                  Effect.map((content) => {
                    modules.push({
                      name: path.relative(outputDir, filePath).replaceAll("\\", "/"),
                      path: filePath,
                      content: Buffer.from(content),
                      type: filePath.endsWith(".cjs") ? "CommonJS" : "ESModule",
                    });
                  }),
                );
              }),
            );
          },
          { concurrency: "unbounded", discard: true },
        ),
      ),
    );

  yield* visit(outputDir);
  return modules;
});

const scanAdditionalEntries = Effect.fn(function* ({
  options,
  fs,
  path,
}: {
  readonly options: CloudflareOptions;
  readonly fs: FileSystem.FileSystem;
  readonly path: Path.Path;
}) {
  if (!options.findAdditionalModules) {
    return options.main;
  }

  const entryRoot = path.dirname(options.main);
  const mainEntryName = path.basename(options.main, path.extname(options.main));
  const entries: Record<string, string> = {
    [mainEntryName]: options.main,
  };

  const visit: (directory: string) => Effect.Effect<void, unknown> = Effect.fn(function* (
    directory: string,
  ) {
    const names = yield* fs.readDirectory(directory);
    yield* Effect.forEach(
      names,
      (name) => {
        if (name === "node_modules" || name.startsWith(".")) {
          return Effect.void;
        }

        const filePath = path.join(directory, name);
        return fs.stat(filePath).pipe(
          Effect.flatMap((stat) => {
            if (stat.type === "Directory") {
              return visit(filePath);
            }

            if (!isAdditionalEntryFile(filePath, options.main, path)) {
              return Effect.void;
            }

            const relativePath = path.relative(entryRoot, filePath);
            const withoutExtension = relativePath.slice(
              0,
              relativePath.length - path.extname(relativePath).length,
            );
            const entryName = withoutExtension.replaceAll("\\", "/");
            entries[entryName] = filePath;
            return Effect.void;
          }),
        );
      },
      { concurrency: "unbounded", discard: true },
    );
  });

  yield* visit(entryRoot);
  return entries;
});

const isAdditionalEntryFile = (filePath: string, main: string, path: Path.Path): boolean => {
  if (filePath === main) {
    return false;
  }

  if (filePath.endsWith(".d.ts")) {
    return false;
  }

  const extension = path.extname(filePath);
  return (
    extension === ".js" ||
    extension === ".mjs" ||
    extension === ".cjs" ||
    extension === ".ts" ||
    extension === ".tsx" ||
    extension === ".jsx"
  );
};

const isEmittedCodeModule = (
  item: OutputChunk | OutputAsset,
  main: string,
  path: Path.Path,
  outputDir: string,
): item is OutputChunk =>
  item.type === "chunk" && path.resolve(outputDir, item.fileName) !== main;

const isEmittedCodeFile = (filePath: string, main: string): boolean =>
  filePath !== main &&
  (filePath.endsWith(".js") || filePath.endsWith(".mjs") || filePath.endsWith(".cjs"));
