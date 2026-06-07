import { spawn } from "node:child_process";
import { resolve } from "node:path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for atlas:analyze-queries.");
}

const sqlFile = resolve("sql/analyze-atlas-queries.sql");

const child = spawn("psql", [process.env.DATABASE_URL, "-f", sqlFile], {
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
