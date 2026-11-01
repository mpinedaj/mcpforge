import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const resolvePath = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@mcpforge/shared": resolvePath("./packages/shared/src/index.ts"),
      "@mcpforge/core": resolvePath("./packages/core/src/index.ts"),
      "@mcpforge/runtime": resolvePath("./packages/runtime/src/index.ts"),
      "@mcpforge/inspector": resolvePath("./packages/inspector/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["packages/**/test/**/*.test.ts"],
    testTimeout: 15000,
  },
});
