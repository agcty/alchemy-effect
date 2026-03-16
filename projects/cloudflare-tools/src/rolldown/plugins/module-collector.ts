import type { Plugin } from "rolldown";
import path from "node:path";
import { ModuleCollectorCore, type ModuleCollectorOptions } from "../../module-collector.js";

export function createModuleCollector(options: ModuleCollectorOptions = {}) {
  const core = new ModuleCollectorCore(options);

  const plugin: Plugin = {
    name: "distilled-module-collector",
    buildStart() {
      core.reset();
    },
    async resolveId(source, importer, extraOptions) {
      const type = core.match(source);
      if (type === null) {
        return null;
      }

      const resolved =
        (await this.resolve(source, importer, {
          kind: extraOptions.kind,
          skipSelf: true,
        })) ?? null;

      const filePath =
        resolved?.id ??
        (importer ? path.resolve(path.dirname(importer), source) : path.resolve(source));

      const module = await core.resolve(filePath, source);
      if (module === null) {
        return null;
      }

      this.addWatchFile(filePath);
      return {
        id: module.fileName,
        external: true,
      };
    },
  };

  return { getModules: () => core.getModules(), plugin };
}
