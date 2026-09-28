import path from "node:path";
import { defineConfig } from "vitest/config";

const rootDir = import.meta.dirname;

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["packages/**/test/**/*.test.ts", "apps/**/test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
  resolve: {
    alias: {
      "@s2c/units": path.resolve(rootDir, "packages/units/src"),
      "@s2c/circuit-json": path.resolve(rootDir, "packages/circuit-json/src"),
      "@s2c/parts": path.resolve(rootDir, "packages/parts/src"),
      "@s2c/core": path.resolve(rootDir, "packages/core/src"),
      "@s2c/rules": path.resolve(rootDir, "packages/rules/src"),
      "@s2c/render-schematic": path.resolve(rootDir, "packages/render-schematic/src"),
      "@s2c/export": path.resolve(rootDir, "packages/export/src"),
      "@s2c/arduino": path.resolve(rootDir, "packages/arduino/src"),
      "@s2c/cli": path.resolve(rootDir, "packages/cli/src"),
      "@s2c/pcb-json": path.resolve(rootDir, "packages/pcb-json/src"),
      "@s2c/footprints": path.resolve(rootDir, "packages/footprints/src"),
    },
  },
});
