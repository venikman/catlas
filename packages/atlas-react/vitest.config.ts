import { defineConfig } from "vitest/config";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [join(packageRoot, "tests/setup.ts")],
  },
  resolve: {
    alias: {
      "@/lib/atlas": join(packageRoot, "src/lib/atlas"),
    },
  },
});
