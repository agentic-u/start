import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["test/**/*.test.ts", "plugins/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
