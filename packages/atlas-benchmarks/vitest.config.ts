import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    exclude: ["src/playwright/**", "dist/**", "node_modules/**"],
  },
});
