import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  createNodesFromFiles,
  type CreateNodesContext,
  type CreateNodes,
  type ProjectConfiguration,
} from "@nx/devkit";

export interface OxlintPluginOptions {
  lintTargetName?: string;
  typeAware?: boolean;
}

/**
 * Nx plugin that infers lint targets for projects with oxlint config files.
 */
const createNodesFunction: CreateNodes<OxlintPluginOptions> = [
  "**/{package,project}.json",
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
  options: OxlintPluginOptions,
  context: CreateNodesContext,
) {
  const projectRoot = dirname(configFilePath);

  const hasOxlintConfig =
    existsSync(join(context.workspaceRoot, projectRoot, ".oxlintrc.json")) ||
    existsSync(join(context.workspaceRoot, projectRoot, "oxlint.config.ts"));

  if (!hasOxlintConfig) {
    return {};
  }

  const lintTargetName = options.lintTargetName || "lint";
  const typeAware = options.typeAware !== false; // Default to true

  // Build the oxlint command
  const oxlintCommand = typeAware ? "oxlint --type-aware ." : "oxlint .";
  const command = oxlintCommand;

  // Create targets - Nx will handle merging with existing targets automatically
  const targets: Record<string, any> = {
    [lintTargetName]: {
      executor: "nx:run-commands",
      options: {
        command,
        cwd: "{projectRoot}",
      },
      cache: true,
      outputs: [],
      inputs: ["taskSources", "^production"],
      // Type-aware linting resolves cross-package types from dependencies' dist output.
      dependsOn: ["^build"],
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

// Export as default plugin object
export default {
  name: "@alchemy.run/nx-oxlint-plugin",
  createNodes: createNodesFunction,
};

// Also export the function directly for compatibility
export const createNodes = createNodesFunction;
