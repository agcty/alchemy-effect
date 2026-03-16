import type { Plugin } from "rolldown";

export const nodejsCompatWarningPlugin = (): Plugin => ({
  name: "distilled-nodejs-compat-warning",
  resolveId(source) {
    if (!source.startsWith("node:")) {
      return null;
    }

    return false;
  },
});
