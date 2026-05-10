import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@lab/api": fileURLToPath(new URL("./apps/api/src/index.ts", import.meta.url)),
      "@lab/api/app": fileURLToPath(new URL("./apps/api/src/app.ts", import.meta.url)),
      "@lab/config": fileURLToPath(new URL("./packages/config/src/index.ts", import.meta.url)),
      "@lab/db": fileURLToPath(new URL("./packages/db/src/index.ts", import.meta.url)),
      "@lab/domain": fileURLToPath(new URL("./packages/domain/src/index.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    pool: "forks",
  },
})
