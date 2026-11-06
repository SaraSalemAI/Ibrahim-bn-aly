import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "console-builder": path.resolve(__dirname, "packages/console-builder/src/index.ts"), "@": path.resolve(__dirname) } },
  test: { include: ["tests/**/*.test.ts", "packages/*/test/**/*.test.ts"] },
});
