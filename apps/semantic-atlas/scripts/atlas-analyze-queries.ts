import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for atlas:analyze-queries.");
}

const sqlFile = fileURLToPath(
  new URL("../../../packages/atlas-benchmarks/src/sql/explain-atlas-queries.sql", import.meta.url),
);

const child = spawn("psql", [process.env.DATABASE_URL, "-f", sqlFile], {
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
