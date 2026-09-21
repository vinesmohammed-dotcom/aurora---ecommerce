import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Disable file-level parallelism so integration test suites sharing a single MongoDB instance run deterministically
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000
  }
});
