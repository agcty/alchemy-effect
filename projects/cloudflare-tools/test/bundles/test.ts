import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as LegacyBundle from "../../src/bundle.js";
import * as AdditionalModules from "../../src/core/AdditionalModules.js";
import * as Bundler from "../../src/core/Bundler.js";
import * as CloudflareInternal from "../../src/core/CloudflareInternal.js";
import * as NodeCompatWarning from "../../src/core/NodeCompatWarning.js";
import * as Unenv from "../../src/core/Unenv.js";
import * as EsbuildBundler from "../../src/esbuild-v2/EsbuildBundler.js";
import * as LegacyEsbuildBundler from "../../src/esbuild/bundle.js";
import { BundleError } from "../harness/bundle-error.js";
import { loadFixture } from "../harness/fixture.js";

import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import assert from "node:assert";
const systemLayers = Layer.provideMerge(NodeFileSystem.layer, NodePath.layer);

const coreLayers = Layer.provideMerge(
  Layer.mergeAll(
    CloudflareInternal.layer,
    AdditionalModules.layer,
    NodeCompatWarning.layer,
    Unenv.layer,
  ),
  systemLayers,
);

const layers = Layer.provideMerge(EsbuildBundler.EsbuildBundler, coreLayers);

const newBundler = Effect.gen(function* () {
  const bundler = yield* Bundler.Bundler;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const fixture = yield* loadFixture("module-rules");
  const outDir = yield* fs.makeTempDirectoryScoped({ prefix: "distilled-bundler-esbuild-" });
  const result = yield* bundler.build({
    main: fixture.entryPoint,
    rootDir: fixture.projectRoot,
    outDir,
    cloudflare: {
      compatibilityDate: fixture.compatibilityDate,
      compatibilityFlags: fixture.compatibilityFlags,
      additionalModules: {
        enable: fixture.findAdditionalModules,
        rules: fixture.rules,
        preserveFileNames: fixture.preserveFileNames,
      },
    },
    define: fixture.define,
    external: fixture.external,
    minify: fixture.minify,
    keepNames: fixture.keepNames,
    tsconfig: fixture.tsconfig,
    format: fixture.format === "service-worker" ? "iife" : "esm",
  });
  console.dir(result, { depth: null });
  for (const module of result.modules) {
    const content = yield* fs.readFile(path.resolve(result.directory, module.name));
    assert.strictEqual(content.toString(), module.content.toString());
  }
}).pipe(Effect.provide(layers), Effect.scoped);

const oldBundler = Effect.gen(function* () {
  const config = yield* loadFixture("module-rules");
  const bundle = yield* LegacyBundle.Bundle;
  const outdir = fs.mkdtempSync(path.join(os.tmpdir(), "distilled-bundler-esbuild-"));

  const options: LegacyBundle.CloudflareOptions = {
    main: config.entryPoint,
    projectRoot: config.projectRoot,
    outputDir: outdir,
    compatibilityDate: config.compatibilityDate,
    compatibilityFlags: config.compatibilityFlags,
    define: config.define,
    rules: config.rules?.map((rule) => ({
      type: rule.type,
      globs: [...rule.globs],
      fallthrough: rule.fallthrough,
    })),
    findAdditionalModules: config.findAdditionalModules,
    preserveFileNames: config.preserveFileNames,
    external: config.external ? [...config.external] : undefined,
    minify: config.minify,
    keepNames: config.keepNames,
    tsconfig: config.tsconfig,
    format: config.format,
  };

  const result = yield* bundle.build(options).pipe(
    Effect.mapError(
      (error) =>
        new BundleError({
          message: `Esbuild bundler failed: ${String(error)}`,
          cause: error,
        }),
    ),
  );

  console.dir(result, { depth: null });
}).pipe(Effect.provide(Layer.provideMerge(LegacyEsbuildBundler.EsbuildBundleLive, systemLayers)));

await Effect.runPromise(newBundler);
// await Effect.runPromise(oldBundler);
