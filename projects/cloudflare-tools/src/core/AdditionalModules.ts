import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import type { PlatformError } from "effect/PlatformError";
import * as Ref from "effect/Ref";
import * as ServiceMap from "effect/ServiceMap";
import GlobToRegExp from "glob-to-regexp";
import { SystemError } from "./Error.js";
import * as Hash from "./Hash.js";
import type { ModuleType } from "./Module.js";
import { Module } from "./Module.js";
import type { Resolve } from "./Utils.js";

export declare namespace AdditionalModules {
  /**
   * A module rule defining how non-JS file types are handled.
   * Port of wrangler's deployment-bundle/rules.ts.
   */
  interface Rule {
    readonly type: ModuleType;
    readonly globs: ReadonlyArray<string>;
    readonly fallthrough?: boolean;
  }

  interface Options {
    /** Whether to scan the filesystem for additional modules. @default true */
    readonly enable?: boolean;
    /** The rules to match the additional modules. */
    readonly rules?: ReadonlyArray<Rule>;
    /** Whether to preserve the original file names instead of content-hashing. @default false */
    readonly preserveFileNames?: boolean;
  }

  interface Result {
    readonly start: () => Effect.Effect<void>;
    readonly resolvers: ReadonlyArray<{
      readonly pattern: RegExp;
      readonly resolve: Resolve.Handler<PlatformError>;
    }>;
    readonly end: () => Effect.Effect<ReadonlyArray<Module>, SystemError>;
  }
}

export class AdditionalModules extends ServiceMap.Service<
  AdditionalModules,
  {
    readonly create: (
      options: AdditionalModules.Options | undefined,
      outDir: string,
    ) => Effect.Effect<AdditionalModules.Result>;
  }
>()("distilled-bundler/AdditionalModules") {}

/**
 * Default module rules matching Cloudflare Workers conventions.
 *
 * - `.txt`, `.html`, `.sql` -> Text modules
 * - `.bin` -> Data (binary) modules
 * - `.wasm`, `.wasm?module` -> CompiledWasm modules
 */
const DEFAULT_MODULE_RULES: Array<AdditionalModules.Rule> = [
  { type: "Text", globs: ["**/*.txt", "**/*.html", "**/*.sql"] },
  { type: "Data", globs: ["**/*.bin"] },
  { type: "CompiledWasm", globs: ["**/*.wasm", "**/*.wasm?module"] },
];

export const layer = Layer.effect(
  AdditionalModules,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const resolvePath = (args: Resolve.Args, context: Resolve.Context) =>
      pipe(
        context.resolve(args, context),
        Effect.orElseSucceed(() => undefined),
        Effect.map((result) => result?.path ?? path.resolve(args.directory, args.path)),
      );

    const copyModule = Effect.fnUntracedEager(function* (
      outDir: string,
      input: {
        readonly name: string;
        readonly path: string;
        readonly hash: string;
        readonly content: Uint8Array;
        readonly type: ModuleType;
      },
    ) {
      const target = path.resolve(outDir, input.name);
      return yield* pipe(
        fs.makeDirectory(path.dirname(target), { recursive: true }),
        Effect.andThen(() => fs.writeFile(target, input.content)),
        Effect.as(
          new Module({
            name: input.name,
            hash: input.hash,
            content: input.content,
            type: input.type,
          }),
        ),
        Effect.mapError(
          (cause) =>
            new SystemError({
              message: `Failed to copy module "${input.name}" to "${outDir}"`,
              cause,
            }),
        ),
      );
    });

    return AdditionalModules.of({
      create: Effect.fn(function* (options, outDir) {
        const rules = parseRules(options?.rules);
        const modulesRef = yield* Ref.make<Record<string, Effect.Effect<Module, SystemError>>>({});

        return {
          start: () => Ref.update(modulesRef, () => ({})),
          resolvers: rules.flatMap((rule) =>
            rule.globs.map(
              (
                pattern,
              ): {
                readonly pattern: RegExp;
                readonly resolve: Resolve.Handler<PlatformError>;
              } => {
                return {
                  pattern: GlobToRegExp(pattern),
                  resolve: Effect.fn(function* (args, context) {
                    const absolutePath = yield* resolvePath(args, context);
                    const content = yield* fs.readFile(absolutePath);
                    const hash = Hash.hash(content);
                    const fileName = options?.preserveFileNames
                      ? path.basename(args.path)
                      : `${hash}-${path.basename(args.path)}`;
                    yield* Ref.update(modulesRef, (modules) => {
                      modules[fileName] ??= copyModule(outDir, {
                        name: fileName,
                        path: absolutePath,
                        content,
                        type: rule.type,
                        hash,
                      });
                      return modules;
                    });
                    return {
                      path: fileName,
                      external: true,
                      watchFiles: [absolutePath],
                    };
                  }),
                };
              },
            ),
          ),
          end: () =>
            Effect.flatMap(Ref.get(modulesRef), (modules) =>
              Effect.all(
                Object.values(modules) as ReadonlyArray<Effect.Effect<Module, SystemError>>,
              ),
            ),
        };
      }),
    });
  }),
);

/**
 * Parses user-defined module rules, merges them with defaults,
 * and handles fallthrough semantics.
 *
 * Rules without `fallthrough: true` "complete" their type — any
 * subsequent rules of the same type are marked as removed.
 *
 * Port of wrangler's deployment-bundle/rules.ts — defines the default
 * module rules for Cloudflare Workers and handles rule merging with
 * fallthrough semantics.
 */
function parseRules(
  userRules: ReadonlyArray<AdditionalModules.Rule> = [],
): ReadonlyArray<AdditionalModules.Rule> {
  const rules: Array<AdditionalModules.Rule> = [...userRules, ...DEFAULT_MODULE_RULES];

  const completedRuleLocations: Record<string, number> = {};
  const rulesToRemove: Array<AdditionalModules.Rule> = [];
  let index = 0;

  for (const rule of rules) {
    if (rule.type in completedRuleLocations) {
      rulesToRemove.push(rule);
    }
    if (!(rule.type in completedRuleLocations) && rule.fallthrough !== true) {
      completedRuleLocations[rule.type] = index;
    }
    index++;
  }

  for (const rule of rulesToRemove) {
    const idx = rules.indexOf(rule);
    if (idx !== -1) {
      rules.splice(idx, 1);
    }
  }

  return rules;
}
