import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ServiceMap from "effect/ServiceMap";
import type { Resolve } from "./Utils.js";

export declare namespace Unenv {
  interface Options {
    readonly compatibilityDate?: string;
    readonly compatibilityFlags?: ReadonlyArray<string>;
  }

  interface Resolution {
    readonly nodeBuiltIn: ResolvedItem<typeof REQUIRED_NODE_BUILT_IN_NAMESPACE>;
    readonly unenvAlias: ResolvedItem<typeof REQUIRED_UNENV_ALIAS_NAMESPACE> | undefined;
    readonly nodeGlobals: ResolveNodeGlobals;
  }

  interface ResolvedItem<Namespace extends string> {
    readonly pattern: RegExp;
    readonly namespace: Namespace;
    readonly resolve: Resolve.Handler;
    readonly load: (path: string) => string | undefined;
  }

  interface ResolveNodeGlobals extends ResolvedItem<typeof VIRTUAL_POLYFILL_PREFIX> {
    readonly inject: ReadonlyArray<string>;
  }
}

export class Unenv extends ServiceMap.Service<
  Unenv,
  {
    readonly create: (options: Unenv.Options) => Effect.Effect<Unenv.Resolution>;
  }
>()("distilled-bundler/Unenv") {}

/**
 * Virtual namespace for converting CJS require() of Node.js builtins to ESM.
 */
const REQUIRED_NODE_BUILT_IN_NAMESPACE = "node-built-in-modules";

/**
 * Virtual namespace for CJS require() of unenv-aliased npm packages.
 */
const REQUIRED_UNENV_ALIAS_NAMESPACE = "required-unenv-alias";

/**
 * Prefix for virtual global polyfill modules.
 */
const VIRTUAL_POLYFILL_PREFIX = "_virtual_unenv_global_polyfill-";

/**
 * Regex to match virtual polyfill module paths.
 */
const VIRTUAL_POLYFILL_RE = new RegExp(
  `${VIRTUAL_POLYFILL_PREFIX.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}(.+)$`,
);

export const layer = Layer.effect(
  Unenv,
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const [{ defineEnv }, { getCloudflarePreset, nonPrefixedNodeModules }] = yield* Effect.promise(
      () => Promise.all([import("unenv"), import("@cloudflare/unenv-preset")]),
    );

    const buildNodeBuiltIn = (): Unenv.ResolvedItem<typeof REQUIRED_NODE_BUILT_IN_NAMESPACE> => {
      // Build regex to match all Node.js module specifiers
      const nodeModulesPattern = nonPrefixedNodeModules
        .map((m: string) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
      const nodeJsModuleRegexp = new RegExp(`^(node:)?(${nodeModulesPattern})$`);

      return {
        pattern: nodeJsModuleRegexp,
        namespace: REQUIRED_NODE_BUILT_IN_NAMESPACE,
        resolve: (args) =>
          Effect.succeed(
            args.isRequire
              ? { path: args.path, namespace: REQUIRED_NODE_BUILT_IN_NAMESPACE }
              : undefined,
          ),
        load: (modulePath: string) =>
          [`import libDefault from '${modulePath}';`, `module.exports = libDefault;`].join("\n"),
      };
    };

    const buildUnenvAlias = (
      alias: Record<string, string>,
      external: ReadonlyArray<string>,
    ): Unenv.ResolvedItem<typeof REQUIRED_UNENV_ALIAS_NAMESPACE> | undefined => {
      // Resolve all aliases to absolute paths
      const aliasAbsolute: Record<string, string> = {};
      for (const [module, unresolvedAlias] of Object.entries(alias)) {
        try {
          aliasAbsolute[module] = require.resolve(unresolvedAlias);
        } catch {
          // Package not installed, skip
        }
      }

      // Build regex matching all alias keys
      const aliasKeys = Object.keys(aliasAbsolute);
      if (aliasKeys.length === 0) return;

      const aliasPattern = aliasKeys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
      const aliasRegexp = new RegExp(`^(${aliasPattern})$`);

      return {
        pattern: aliasRegexp,
        namespace: REQUIRED_UNENV_ALIAS_NAMESPACE,
        resolve: (args) =>
          Effect.sync(() => {
            const unresolvedAlias = alias[args.path];
            if (
              args.isRequire &&
              unresolvedAlias &&
              (unresolvedAlias.startsWith("unenv/npm/") ||
                unresolvedAlias.startsWith("unenv/mock/"))
            ) {
              return {
                path: args.path,
                namespace: REQUIRED_UNENV_ALIAS_NAMESPACE,
              };
            }
            const resolvedPath = aliasAbsolute[args.path];
            if (resolvedPath && unresolvedAlias) {
              return {
                path: resolvedPath,
                external: external.includes(unresolvedAlias),
              };
            }
            return undefined;
          }),
        load: (modulePath) => {
          return [
            `import * as esm from '${modulePath}';`,
            `module.exports = Object.entries(esm)`,
            `  .filter(([k,]) => k !== 'default')`,
            `  .reduce((cjs, [k, value]) =>`,
            `    Object.defineProperty(cjs, k, { value, enumerable: true }),`,
            `    "default" in esm ? esm.default : {}`,
            `  );`,
          ].join("\n");
        },
      };
    };

    const buildNodeGlobals = (
      inject: Record<string, string | ReadonlyArray<string>>,
      polyfill: ReadonlyArray<string>,
    ): Unenv.ResolveNodeGlobals => {
      // Parse the inject map into grouped data structures
      interface InjectedGlobal {
        injectedName: string;
        exportName: string;
        importName: string;
      }

      const injectsByModule = new Map<string, Array<InjectedGlobal>>();

      for (const [injectedName, value] of Object.entries(inject)) {
        if (!value) continue;

        let module: string;
        let exportName: string;
        let importName: string;

        if (typeof value === "string") {
          module = value;
          exportName = "default";
          importName = "defaultExport";
        } else {
          module = value[0] as string;
          exportName = value[1] as string;
          importName = exportName;
        }

        const existing = injectsByModule.get(module) ?? [];
        existing.push({ injectedName, exportName, importName });
        injectsByModule.set(module, existing);
      }

      // Use import.meta.dirname as the base path for virtual module anchoring
      const prefix = path.resolve(import.meta.dirname, VIRTUAL_POLYFILL_PREFIX);

      // Map virtual module paths to their source module specifiers
      const virtualModulePathToSpecifier = new Map<string, string>();
      for (const [moduleSpecifier] of injectsByModule) {
        const sanitized = moduleSpecifier.replaceAll("/", "-");
        const virtualPath = prefix + sanitized;
        virtualModulePathToSpecifier.set(virtualPath, moduleSpecifier);
      }

      // Mutate esbuild's inject option to include our virtual modules + polyfills
      return {
        pattern: VIRTUAL_POLYFILL_RE,
        namespace: VIRTUAL_POLYFILL_PREFIX,
        resolve: (args) => Effect.succeed({ path: args.path }),
        load: (modulePath: string) => {
          const moduleSpecifier = virtualModulePathToSpecifier.get(modulePath);
          if (!moduleSpecifier) return undefined;

          const globals = injectsByModule.get(moduleSpecifier);
          if (!globals) return undefined;

          const lines: Array<string> = [];

          // Build import statement
          const imports = globals.map((g) =>
            g.exportName === "default"
              ? `default as ${g.importName}`
              : `${g.exportName} as ${g.importName}`,
          );
          lines.push(`import { ${imports.join(", ")} } from "${moduleSpecifier}";`);

          // Build global assignments
          for (const g of globals) {
            lines.push(`globalThis.${g.injectedName} = ${g.importName};`);
          }

          return lines.join("\n");
        },
        inject: [
          ...virtualModulePathToSpecifier.keys(),
          ...polyfill.map((m) => {
            try {
              return require.resolve(m);
            } catch {
              return m;
            }
          }),
        ],
      };
    };

    return Unenv.of({
      create: Effect.fn(function* (options) {
        // Get the resolved environment configuration
        const { alias, inject, external, polyfill } = defineEnv({
          presets: [
            getCloudflarePreset({
              compatibilityDate: options.compatibilityDate,
              compatibilityFlags: options.compatibilityFlags
                ? [...options.compatibilityFlags]
                : undefined,
            }),
            {
              alias: {
                // Force esbuild to use node implementation of debug
                debug: "debug",
              },
            },
          ],
          npmShims: true,
        }).env;

        return {
          // --- Handler 1: Convert CJS require() of Node.js builtins to ESM ---
          nodeBuiltIn: buildNodeBuiltIn(),
          // --- Handler 2: Resolve unenv aliases + externalize native modules ---
          unenvAlias: buildUnenvAlias(alias, external),
          // --- Handler 3: Inject Node.js globals (process, Buffer, etc.) ---
          nodeGlobals: buildNodeGlobals(inject, polyfill),
        };
      }),
    });
  }),
);
