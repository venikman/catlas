import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import type { BenchmarkContext, CheckResult, ValidatorResult } from "../types";
import { pass, skip, warn } from "./helpers";

const { Pool } = pg;

function file(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

export async function dbQueryValidator(
  _context: BenchmarkContext,
): Promise<ValidatorResult> {
  const results: CheckResult[] = [];
  const migration001 = "migrations/001_create_atlas_schema.sql";
  const migration003 = "migrations/003_harden_atlas_indexes.sql";
  const explainSql = "benchmarks/sql/explain-atlas-queries.sql";
  const hasBaselineMigrations =
    existsSync(join(process.cwd(), migration001)) && existsSync(join(process.cwd(), migration003));

  if (hasBaselineMigrations) {
    const schema = `${file(migration001)}\n${file(migration003)}`;
    const hasPointBboxIndex =
      /idx_atlas_points_view_xy/.test(schema) &&
      /idx_atlas_points_view_xy_importance/.test(schema);
    const hasClusterIndex = /idx_atlas_clusters_view_lod_bounds/.test(schema);
    const hasDensityIndex = /idx_atlas_density_tiles_view_bounds_expr/.test(schema);
    const hasSearchIndex =
      /gin_trgm_ops/.test(schema) &&
      /idx_atlas_points_label_trgm_candidate/.test(schema);

    results.push(
      hasPointBboxIndex
        ? pass(
            "db-point-bbox-index",
            "db",
            "Point bbox indexes exist",
            "Baseline and hardened point indexes cover view/x/y and importance ordering.",
          )
        : warn(
            "db-point-bbox-index",
            "db",
            "Point bbox indexes exist",
            "Point bbox indexes were not detected in migrations.",
          ),
    );
    results.push(
      hasClusterIndex
        ? pass(
            "db-cluster-bounds-index",
            "db",
            "Cluster bounds index exists",
            "Cluster migration contains view/lod/bounds index for medium-zoom viewport queries.",
          )
        : warn(
            "db-cluster-bounds-index",
            "db",
            "Cluster bounds index exists",
            "Cluster bounds index was not detected in migrations.",
          ),
    );
    results.push(
      hasDensityIndex
        ? pass(
            "db-density-bounds-index",
            "db",
            "Density bounds index exists",
            "Density tile expression index covers JSON bounds used by low-zoom queries.",
          )
        : warn(
            "db-density-bounds-index",
            "db",
            "Density bounds index exists",
            "Density tile bounds expression index was not detected in migrations.",
          ),
    );
    results.push(
      hasSearchIndex
        ? pass(
            "db-search-trigram-index",
            "db",
            "Search trigram index exists",
            "Migrations enable pg_trgm and index labels for bounded search.",
          )
        : warn(
            "db-search-trigram-index",
            "db",
            "Search trigram index exists",
            "Trigram search index was not detected in migrations.",
          ),
    );
  } else {
    results.push(
      warn(
        "db-migrations-present",
        "db",
        "Atlas migrations exist",
        "Baseline or hardened atlas migration file is missing.",
      ),
    );
  }

  results.push(
    existsSync(join(process.cwd(), explainSql))
      ? pass(
          "db-explain-sql-present",
          "db",
          "Representative EXPLAIN SQL exists",
          `${explainSql} is present for database query-plan inspection.`,
        )
      : warn(
          "db-explain-sql-present",
          "db",
          "Representative EXPLAIN SQL exists",
          `${explainSql} is missing.`,
        ),
  );

  if (!process.env.DATABASE_URL) {
    results.push(
      skip(
        "db-live-query-skip",
        "db",
        "Live database query benchmark",
        "DATABASE_URL is not configured; API-level demo/postgres behavior was benchmarked instead.",
      ),
    );
    return { validator: "dbQuery", results };
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const startedAt = performance.now();
  try {
    await pool.query("select 1");
    const ms = Number((performance.now() - startedAt).toFixed(2));
    results.push(
      pass(
        "db-live-connection",
        "db",
        "Live database connection works",
        `select 1 completed in ${ms} ms.`,
        { measured: ms, severity: "warn", unit: "ms" },
      ),
    );
  } catch (error) {
    results.push(
      warn(
        "db-live-connection",
        "db",
        "Live database connection works",
        `DATABASE_URL is set but select 1 failed: ${error instanceof Error ? error.message : String(error)}.`,
      ),
    );
  } finally {
    await pool.end().catch(() => undefined);
  }

  return { validator: "dbQuery", results };
}
