import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import pg from "pg";

const { Pool } = pg;

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for db:migrate.");
}

const migrationFiles = [
  "migrations/001_create_atlas_schema.sql",
  ...(flag("postgis") || process.env.ATLAS_ENABLE_POSTGIS === "true"
    ? ["migrations/002_optional_postgis.sql"]
    : []),
  "migrations/003_harden_atlas_indexes.sql",
];

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

async function run() {
  for (const file of migrationFiles) {
    const path = resolve(file);
    const sql = readFileSync(path, "utf8");
    const startedAt = performance.now();
    await pool.query(sql);
    const ms = Number((performance.now() - startedAt).toFixed(2));
    console.log(`applied ${basename(file)} in ${ms} ms`);
  }
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
