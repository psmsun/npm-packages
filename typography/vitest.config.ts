import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@/lib/utils": fileURLToPath(new URL("./src/__fixtures__/cn.ts", import.meta.url)),
    },
  },
});
