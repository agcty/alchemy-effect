import type { Plugin } from "rolldown";

export const cloudflareInternalPlugin = (): Plugin => {
  const paths = new Set<string>();

  return {
    name: "distilled-cloudflare-internal",
    buildStart() {
      paths.clear();
    },
    resolveId(source) {
      if (!source.startsWith("cloudflare:")) {
        return null;
      }

      paths.add(source);
      return false;
    },
    generateBundle(outputOptions) {
      if (outputOptions.format === "iife" && paths.size > 0) {
        const pathList = Array.from(paths)
          .map((path) => `"${path}"`)
          .sort()
          .join(", ");
        throw new Error(
          `Unexpected external import of ${pathList}. ` +
            `Your worker has no default export, which means it is assumed to be a Service Worker format Worker. ` +
            `Did you mean to create a ES Module format Worker? ` +
            `If so, try adding \`export default { ... }\` in your entry-point. ` +
            `See https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/.`,
        );
      }
    },
  };
};
