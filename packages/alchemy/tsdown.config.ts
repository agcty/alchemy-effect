import { defineConfig } from "tsdown";

export default [
  // bundle the CLi into a standalone executable so react/ink/pathe can stay
  // devDependencies and aren't installed for every consumer of `alchemy`.
  //
  // Modules in this bundle that need on-disk paths to themselves (or to
  // sibling source files) must NOT use relative `import.meta.resolve` /
  // `import.meta.filename` — after inlining, both point at `bin/alchemy.js`.
  // Resolve via the package name instead, e.g.
  //   import.meta.resolve("alchemy/Cloudflare/Local/SidecarServer.ts")
  // and add a matching entry in the package.json `exports` map so the
  // resolution succeeds in both source checkouts and published installs.
  // See PR #128 for the original case (bin/exec.ts).
  defineConfig({
    entry: ["bin/alchemy.ts"],
    format: ["esm"],
    clean: false,
    shims: true,
    outDir: "bin",
    dts: false,
    sourcemap: true,
    outputOptions: {
      inlineDynamicImports: true,
    },
    noExternal: ["execa", "open", "env-paths"],
    tsconfig: "tsconfig.bundle.json",
  }),
  // bundle the dev-mode worker entrypoint. dev.ts spawns this in a child bun
  // process; under a published install it loads from node_modules and would
  // otherwise need react/ink/pathe at runtime to resolve InkCLI.tsx as source.
  // Bundling inlines those so they stay devDependencies (same rationale as
  // the cli bundle below).
  defineConfig({
    entry: ["bin/exec.ts"],
    format: ["esm"],
    clean: false,
    shims: true,
    outDir: "bin",
    dts: false,
    sourcemap: true,
    outputOptions: {
      inlineDynamicImports: true,
    },
    tsconfig: "tsconfig.bundle.json",
  }),
];
