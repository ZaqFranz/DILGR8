import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors tsconfig.json's "@/*": ["*"] (baseUrl "src") - tsc-alias
    // rewrites this at build time, but vitest resolves modules through Vite
    // directly and never reads tsconfig's `paths`, so it needs its own alias.
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
