import { existsSync, readFileSync } from "node:fs";
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

interface PackageJson {
  scripts?: Record<string, string>;
}

interface ProjectJson {
  targets?: Record<string, unknown>;
}

/**
 * Nx plugin that infers lint targets for projects with oxlint config files in
 * their root or an ancestor directory.
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

  if (!findOxlintConfigRoot(context.workspaceRoot, projectRoot)) {
    return {};
  }

  const lintTargetName = options.lintTargetName || "lint";
  const typeAware = options.typeAware !== false; // Default to true

  if (
    hasDeclaredTarget(join(context.workspaceRoot, projectRoot), lintTargetName)
  ) {
    return {};
  }

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

function findOxlintConfigRoot(workspaceRoot: string, projectRoot: string) {
  let current = projectRoot;

  while (true) {
    if (
      existsSync(join(workspaceRoot, current, ".oxlintrc.json")) ||
      existsSync(join(workspaceRoot, current, "oxlint.config.ts"))
    ) {
      return current;
    }

    if (current === "." || current === "") {
      return undefined;
    }

    const parent = dirname(current);

    if (parent === current) {
      return undefined;
    }

    current = parent === "" ? "." : parent;
  }
}

function hasDeclaredTarget(absoluteProjectRoot: string, targetName: string) {
  const packageJson = readJson<PackageJson>(
    join(absoluteProjectRoot, "package.json"),
  );
  if (Object.hasOwn(packageJson?.scripts ?? {}, targetName)) {
    return true;
  }

  const projectJson = readJson<ProjectJson>(
    join(absoluteProjectRoot, "project.json"),
  );
  return Object.hasOwn(projectJson?.targets ?? {}, targetName);
}

function readJson<T>(path: string): T | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return undefined;
  }
}

// Export as default plugin object
export default {
  name: "@alchemy.run/nx-oxlint-plugin",
  createNodes: createNodesFunction,
};

// Also export the function directly for compatibility
export const createNodes = createNodesFunction;
