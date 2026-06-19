import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "exit-hook": "src/exit-hook.ts",
    ignore: "src/ignore.ts",
    lockfile: "src/lockfile-async.ts",
    retry: "src/retry.ts",
  },
  format: ["esm"],
  outDir: "lib",
  dts: {
    tsgo: true,
    sourcemap: true,
    build: true,
  },
  sourcemap: true,
  clean: true,
  tsconfig: "tsconfig.src.json",
  target: "esnext",
  platform: "node",
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  treeshake: true,
  minify: false,
  deps: { skipNodeModulesBundle: true },
});
