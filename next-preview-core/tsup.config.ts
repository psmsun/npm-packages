import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  external: ["react", "react-dom", "@tanstack/react-query"],
  esbuildOptions(options) {
    // Force Next.js App Router client directive on the output bundles
    options.banner = {
      js: '"use client";',
    };
  },
});
