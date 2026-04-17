import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [tsconfigPaths({ projects: ["./tsconfig.test.json"] })],
  test: {
    root: "packages/alchemy",
    pool: "threads",
    maxWorkers: 32,
    testTimeout: 120000,
    hookTimeout: 120000,
    passWithNoTests: true,
    sequence: {
      concurrent: true,
    },
    include: ["test/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/lib/**",
      "**/.{idea,git,cache,output,temp}/**",
    ],
    env: {
      NODE_ENV: "test",
    },
    globals: true,
    // reporter: ['verbose'],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        ".distilled/**",
        "coverage/**",
        "dist/**",
        "lib/**",
        "**/node_modules/**",
        "**/*.test.ts",
        "**/*.config.*",
      ],
    },
    setupFiles: ["test/vitest.setup.ts"],
  },
});
