import { defineConfig } from "vitest/config";

// One shared Postgres: test files must not run concurrently.
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], fileParallelism: false, testTimeout: 20_000, hookTimeout: 20_000 },
});
