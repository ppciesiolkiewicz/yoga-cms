import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["scripts/**/*.test.ts", "src/**/*.test.ts", "core/**/*.test.ts"],
    environment: "node",
    testTimeout: 10_000,
  },
})
