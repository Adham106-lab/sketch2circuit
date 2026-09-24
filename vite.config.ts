import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = import.meta.dirname;

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(rootDir, "."),
        "@s2c/core": path.resolve(rootDir, "packages/core/src/index.ts"),
        "@s2c/circuit-json": path.resolve(rootDir, "packages/circuit-json/src/index.ts"),
        "@s2c/units": path.resolve(rootDir, "packages/units/src/index.ts"),
        "@s2c/parts": path.resolve(rootDir, "packages/parts/src/index.ts"),
        "@s2c/rules": path.resolve(rootDir, "packages/rules/src/index.ts"),
        "@s2c/render-schematic": path.resolve(rootDir, "packages/render-schematic/src/index.ts"),
        "@s2c/arduino": path.resolve(rootDir, "packages/arduino/src/index.ts"),
        "@s2c/export": path.resolve(rootDir, "packages/export/src/index.ts"),
      },
    },
    server: {
      port: 3000,
      host: "0.0.0.0",
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== "true",
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === "true" ? null : {},
    },
  };
});
