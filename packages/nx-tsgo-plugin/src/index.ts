import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  createNodesFromFiles,
  type CreateNodesContext,
  type CreateNodes,
  type ProjectConfiguration,
} from "@nx/devkit";

export interface TsgoPluginOptions {
  typecheckTargetName?: string;
}

/**
 * Nx plugin that infers typecheck targets using tsgo.
 */
const createNodesFunction: CreateNodes<TsgoPluginOptions> = [
  "**/tsconfig.json",
  async (configFiles, options, context) => {
    return await createNodesFromFiles(
      (configFile, options, context) =>
        createNodesInternal(configFile, options ?? {}, context),
      configFiles,
      options,
      context,
    );
  },
];

async function createNodesInternal(
  configFilePath: string,
  options: TsgoPluginOptions,
  context: CreateNodesContext,
) {
  const projectRoot = dirname(configFilePath);

  // Skip workspace root tsconfig
  if (projectRoot === ".") {
    return {};
  }

  // Must be an actual project (has package.json or project.json)
  const absoluteProjectRoot = join(context.workspaceRoot, projectRoot);
  const siblingFiles = readdirSync(absoluteProjectRoot);
  if (
    !siblingFiles.includes("package.json") &&
    !siblingFiles.includes("project.json")
  ) {
    return {};
  }

  const typecheckTargetName = options.typecheckTargetName || "typecheck";

  const targets: Record<string, any> = {
    [typecheckTargetName]: {
      command: "bun tsgo -b --emitDeclarationOnly",
      options: { cwd: "{projectRoot}" },
      cache: true,
      dependsOn: ["^typecheck"],
      metadata: {
        technologies: ["typescript"],
        description: "Type-checks the project using tsgo.",
      },
    },
  };

  const projectConfiguration: ProjectConfiguration = {
    root: projectRoot,
    targets,
  };

  return {
    projects: {
      [projectRoot]: projectConfiguration,
    },
  };
}

export default {
  name: "@alchemy.run/nx-tsgo-plugin",
  createNodes: createNodesFunction,
};

export const createNodes = createNodesFunction;
