import type { Plugin, TransformOptions } from "rolldown";
import { resolveUnenv, type ResolveUnenvOptions } from "../../nodejs-compat-env.js";

export interface NodejsCompatOptions extends ResolveUnenvOptions {}

export interface NodejsCompatConfig {
  readonly plugin: Plugin;
  readonly transform: Pick<TransformOptions, "inject">;
  readonly alias: Record<string, string>;
}

export async function createNodejsCompat(options: NodejsCompatOptions = {}): Promise<NodejsCompatConfig> {
  const env = await resolveUnenv(options);

  return {
    plugin: {
      name: "distilled-nodejs-compat",
      resolveId(source) {
        const resolvedAlias = env.alias[source];
        if (resolvedAlias) {
          return {
            id: resolvedAlias.resolvedPath,
            external: env.external.includes(resolvedAlias.source),
          };
        }

        if (env.nodeModulePattern.test(source)) {
          return false;
        }

        return null;
      },
    },
    transform: {
      inject: Object.fromEntries(
        Object.entries(env.inject).map(([name, value]) => [
          name,
          typeof value === "string" ? value : [value[0] as string, value[1] as string],
        ]),
      ),
    },
    alias: Object.fromEntries(
      Object.entries(env.alias).map(([name, value]) => [name, value.resolvedPath]),
    ),
  };
}
