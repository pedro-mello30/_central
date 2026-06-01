import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      // CLI entry (run.ts), type-only files, and base interface are excluded.
      include: ["core/**/*.ts", "adapters/**/*.ts"],
      exclude: ["**/*.test.ts", "core/types.ts", "adapters/base.ts"],
      thresholds: {
        lines: 80,
        statements: 80,
        branches: 75,
        functions: 90,
      },
    },
  },
});
