import cloudflareRolldown from "@distilled.cloud/cloudflare-rolldown-plugin";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import type * as Path from "effect/Path";
import * as Stream from "effect/Stream";
import { fileURLToPath } from "node:url";
import path from "pathe";
import picomatch from "picomatch";
import type * as rolldown from "rolldown";
import * as Bundle from "../../Bundle/Bundle.ts";
import { findCwdForBundle } from "../../Bundle/TempRoot.ts";
import { sha256, sha256Object } from "../../Util/sha256.ts";
import {
  isDurableObjectExport,
  type DurableObjectExport,
} from "./DurableObjectNamespace.ts";
import { isWorkflowExport, type WorkflowExport } from "./Workflow.ts";

export interface WorkerBundleOptions {
  id: string;
  main: string;
  compatibility: {
    date: string;
    flags: string[];
  };
  entry:
    | {
        kind: "external";
      }
    | {
        kind: "effect";
        exports: Record<string, DurableObjectExport | WorkflowExport>;
      };
  stack: { name: string; stage: string };
  extraOptions: Bundle.BundleExtraOptions | undefined;
}

export const WorkerBundle = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const context = yield* Effect.context<FileSystem.FileSystem | Path.Path>();
  const virtualEntryPlugin = yield* Bundle.virtualEntryPlugin;

  const makeOptions = Effect.fnUntraced(function* (
    options: WorkerBundleOptions,
  ) {
    const realMain = yield* sanitizeMain(options.main);
    const inputOptions: rolldown.InputOptions = {
      input: realMain,
      // Forever-devtool native modules that vite/chokidar reference behind
      // runtime guards. Rolldown resolves before tree-shaking, so the dead
      // `require('../pkg')` (lightningcss < 1.32) and `require('fsevents')`
      // (darwin-only) trip [UNRESOLVED_IMPORT] before DCE can prune them.
      // See rolldown/tsdown#212.
      external: ["lightningcss", "fsevents"],
      cwd: yield* findCwdForBundle(realMain).pipe(
        Effect.mapError(
          (cause) =>
            new Bundle.BundleError({
              message: `Failed to find cwd for bundle: ${realMain}`,
              cause,
            }),
        ),
        Effect.provide(context),
      ),
      plugins: [
        cloudflareRolldown({
          compatibilityDate: options.compatibility.date,
          compatibilityFlags: options.compatibility.flags,
        }),
        options.entry.kind === "effect"
          ? [
              virtualEntryPlugin(
                makeEffectVirtualEntry(options.entry.exports, options.stack),
              ),
            ]
          : undefined,
      ],
      checks: {
        // Suppress unresolved import warnings for unrelated AWS packages
        unresolvedImport: false,
        // Suppress warning caused by static import of `@effect/platform-node/NodeServices` in `WorkerBridge.ts`
        ineffectiveDynamicImport: false,
      },
    };
    const outputOptions: rolldown.OutputOptions = {
      format: "esm",
      sourcemap: "hidden",
      minify: true,
      keepNames: true,
      dir: `.alchemy/bundles/${options.id}`,
    };
    return { inputOptions, outputOptions, extraOptions: options.extraOptions };
  });

  const sanitizeMain = (main: string) =>
    Effect.sync(() => {
      try {
        return fileURLToPath(main);
      } catch {
        return main;
      }
    }).pipe(
      Effect.flatMap((p) => fs.realPath(p)),
      //* fix windows paths
      Effect.map((p) => path.resolve(p)),
      Effect.mapError(
        (cause) =>
          new Bundle.BundleError({
            message: `Failed to find real path for bundle: ${main}`,
            cause,
          }),
      ),
    );

  return {
    build: flow(
      makeOptions,
      Effect.flatMap((resolved) =>
        Bundle.build(
          resolved.inputOptions,
          resolved.outputOptions,
          resolved.extraOptions,
        ),
      ),
    ),
    watch: flow(
      makeOptions,
      Stream.fromEffect,
      Stream.flatMap((resolved) =>
        Bundle.watch(
          resolved.inputOptions,
          resolved.outputOptions,
          resolved.extraOptions,
        ),
      ),
    ),
  };
});

export const makeEffectVirtualEntry = (
  exports: Record<string, DurableObjectExport | WorkflowExport>,
  stack: { name: string; stage: string },
) => {
  const doClasses: string[] = [];
  const wfClasses: string[] = [];
  for (const [className, entry] of Object.entries(exports)) {
    if (isDurableObjectExport(entry)) {
      doClasses.push(className);
    } else if (isWorkflowExport(entry)) {
      wfClasses.push(className);
    }
  }
  const hasDoClasses = doClasses.length > 0;
  const hasWfClasses = wfClasses.length > 0;
  return (importPath: string) => `
import * as Effect from "effect/Effect";

import { env, DurableObject, WorkerEntrypoint${hasWfClasses ? ", WorkflowEntrypoint" : ""} } from "cloudflare:workers";
import { makeDurableObjectBridge, makeWorkerBridge${hasWfClasses ? ", makeWorkflowBridge" : ""} } from "alchemy/Cloudflare";
import { makeEntrypointLayer } from "alchemy/Runtime";

import entrypoint from ${JSON.stringify(importPath)};

const meta = {
  entrypoint,
  stack: {
    name: ${JSON.stringify(stack.name)},
    stage: ${JSON.stringify(stack.stage)},
  },
};

export default makeWorkerBridge(WorkerEntrypoint, meta);

// export class proxy stubs for Durable Objects and Workflows
${[
  ...(hasDoClasses
    ? [
        "const DurableObjectBridge = makeDurableObjectBridge(DurableObject, meta);",
        ...doClasses.map(
          (id) => `export class ${id} extends DurableObjectBridge("${id}") {}`,
        ),
      ]
    : []),
  ...(hasWfClasses
    ? [
        "const WorkflowBridgeFn = makeWorkflowBridge(WorkflowEntrypoint, meta);",
        ...wfClasses.map(
          (id) => `export class ${id} extends WorkflowBridgeFn("${id}") {}`,
        ),
      ]
    : []),
].join("\n")}
`;
};

/**
 * A rule selecting additional module files to upload alongside the entry
 * of a prebuilt Worker (`bundle: false`). Globs are matched against
 * POSIX-style paths relative to the directory containing the Worker's
 * entry module, mirroring Wrangler's `rules` configuration.
 */
export interface ModuleRule {
  readonly globs: readonly string[];
}

/**
 * The default {@link ModuleRule | module rules} applied when
 * `bundle: false` is set without explicit rules — the same set Wrangler
 * applies to `no_bundle` Workers: ESModule (`**\/*.js`, `**\/*.mjs`),
 * CompiledWasm (`**\/*.wasm`), Text (`**\/*.txt`, `**\/*.html`,
 * `**\/*.sql`), and Data (`**\/*.bin`). Source maps (`.js.map`) are
 * deliberately not uploaded.
 */
export const defaultModuleRules: ModuleRule[] = [
  { globs: ["**/*.js", "**/*.mjs"] },
  { globs: ["**/*.wasm"] },
  { globs: ["**/*.txt", "**/*.html", "**/*.sql"] },
  { globs: ["**/*.bin"] },
];

export interface PrebuiltWorkerBundleOptions {
  /**
   * Path (or `file://` URL) to the prebuilt, runtime-ready entry module.
   */
  main: string;
  /**
   * Module rules selecting additional files to upload alongside the
   * entry. Defaults to {@link defaultModuleRules}.
   */
  rules?: readonly ModuleRule[] | undefined;
}

/**
 * Read a prebuilt Worker bundle from disk without bundling.
 *
 * The entry's directory is walked recursively and every file matching the
 * rule globs is uploaded byte-for-byte as an additional module, named by
 * its POSIX path relative to that directory — the same contract as
 * Wrangler's `find_additional_modules` and Alchemy v1's `noBundle`. The
 * entry file is always first and never duplicated as an additional
 * module.
 */
export const readPrebuiltWorkerBundle = Effect.fnUntraced(function* (
  options: PrebuiltWorkerBundleOptions,
) {
  const fs = yield* FileSystem.FileSystem;
  const realMain = yield* Effect.sync(() => {
    try {
      return fileURLToPath(options.main);
    } catch {
      return options.main;
    }
  }).pipe(
    // Resolve without following symlinks (Alchemy v1 parity): the module
    // walk happens in the directory the user pointed at, not the entry's
    // canonical location.
    Effect.map((p) => path.resolve(p)),
  );
  yield* fs.stat(realMain).pipe(
    Effect.mapError(
      (cause) =>
        new Bundle.BundleError({
          message: `Failed to read prebuilt worker entry: ${options.main}`,
          cause,
        }),
    ),
  );
  const root = path.dirname(realMain);
  const entryName = path.basename(realMain);
  const isMatch = picomatch(
    (options.rules ?? defaultModuleRules).flatMap((rule) => rule.globs),
    // Wrangler's glob matching does not special-case dotfiles, and
    // prebuilt output dirs commonly contain hidden directories.
    { dot: true },
  );

  const readModuleFile = Effect.fnUntraced(function* (name: string) {
    const file = path.join(root, name);
    const content = yield* fs.readFile(file).pipe(
      Effect.mapError(
        (cause) =>
          new Bundle.BundleError({
            message: `Failed to read prebuilt worker bundle module: ${file}`,
            cause,
          }),
      ),
    );
    const hash = yield* sha256(content);
    return { path: name, content, hash } satisfies Bundle.BundleFile;
  });

  const entries = yield* fs.readDirectory(root, { recursive: true }).pipe(
    Effect.mapError(
      (cause) =>
        new Bundle.BundleError({
          message: `Failed to read prebuilt worker bundle directory: ${root}`,
          cause,
        }),
    ),
  );
  // Module names always use `/`, also required to match globs on Windows.
  const candidates = entries
    .map((entry) => entry.replaceAll("\\", "/"))
    .filter((name) => name !== entryName && isMatch(name))
    .sort((a, b) => a.localeCompare(b));
  const additionalNames = yield* Effect.forEach(
    candidates,
    (name) =>
      fs.stat(path.join(root, name)).pipe(
        Effect.map((stat) => (stat.type === "File" ? name : undefined)),
        Effect.mapError(
          (cause) =>
            new Bundle.BundleError({
              message: `Failed to stat prebuilt worker bundle module: ${path.join(root, name)}`,
              cause,
            }),
        ),
      ),
    { concurrency: 16 },
  ).pipe(Effect.map((names) => names.filter((name) => name !== undefined)));

  const entryFile = yield* readModuleFile(entryName);
  const additionalFiles = yield* Effect.forEach(
    additionalNames,
    readModuleFile,
    { concurrency: 16 },
  );
  const files: [Bundle.BundleFile, ...Bundle.BundleFile[]] = [
    entryFile,
    ...additionalFiles,
  ];
  const hash = yield* sha256Object(
    files.map((file) => ({ path: file.path, hash: file.hash })),
  );
  return { files, hash } satisfies Bundle.BundleOutput;
});
