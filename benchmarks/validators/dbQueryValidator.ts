import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { ATLAS_BUDGETS, BUDGETS } from "../budgets";
import { computeBbox } from "../scenarios";
import type { BenchmarkContext, CheckResult, ValidatorResult } from "../types";
import { percentiles } from "../types";
import { fail, pass, skip, warn } from "./helpers";

const { Pool } = pg;

type PlanNode = {
  "Index Name"?: string;
  "Node Type"?: string;
  Plans?: PlanNode[];
  "Relation Name"?: string;
  "Total Cost"?: number;
};

type PlanFinding = {
  indexes: string[];
  nodeTypes: string[];
  relations: string[];
  sequentialRelations: string[];
};

type DbScenario = {
  budgetMs: number;
  expectedIndexPattern?: RegExp;
  id: string;
  label: string;
  maxRows?: number;
  params: unknown[];
  seqScanRelation?: string;
  sotaMs: number;
  sql: string;
};

function file(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function collectPlan(node: PlanNode, finding: PlanFinding): void {
  if (node["Node Type"]) finding.nodeTypes.push(node["Node Type"]);
  if (node["Relation Name"]) finding.relations.push(node["Relation Name"]);
  if (node["Index Name"]) finding.indexes.push(node["Index Name"]);
  if (node["Node Type"] === "Seq Scan" && node["Relation Name"]) {
    finding.sequentialRelations.push(node["Relation Name"]);
  }
  for (const child of node.Plans ?? []) collectPlan(child, finding);
}

function analyzePlan(planRows: Array<Record<string, unknown>>): PlanFinding {
  const rawPlan = planRows[0]?.["QUERY PLAN"];
  const root = Array.isArray(rawPlan)
    ? ((rawPlan[0] as { Plan?: PlanNode } | undefined)?.Plan ?? null)
    : null;
  const finding: PlanFinding = {
    indexes: [],
    nodeTypes: [],
    relations: [],
    sequentialRelations: [],
  };
  if (root) collectPlan(root, finding);
  return finding;
}

async function tableCount(pool: pg.Pool, table: string): Promise<number> {
  const result = await pool.query<{ count: string }>(`select count(*) from ${table}`);
  return Number(result.rows[0]?.count ?? 0);
}

async function hasExtension(pool: pg.Pool, extension: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    "select exists(select 1 from pg_extension where extname = $1)",
    [extension],
  );
  return Boolean(result.rows[0]?.exists);
}

async function timeScenario(
  pool: pg.Pool,
  scenario: DbScenario,
  repetitions: number,
): Promise<{
  columns: string[];
  count: number;
  plan: PlanFinding;
  sample: ReturnType<typeof percentiles>;
}> {
  const timings: number[] = [];
  let columns: string[] = [];
  let count = 0;

  for (let index = 0; index < repetitions; index += 1) {
    const startedAt = performance.now();
    const result = await pool.query(scenario.sql, scenario.params);
    timings.push(Number((performance.now() - startedAt).toFixed(2)));
    columns = result.fields.map((field) => field.name);
    count = result.rowCount ?? result.rows.length;
  }

  const planResult = await pool.query(
    `explain (analyze, buffers, format json) ${scenario.sql}`,
    scenario.params,
  );

  return {
    columns,
    count,
    plan: analyzePlan(planResult.rows),
    sample: percentiles(timings),
  };
}

function scenarioStatus(
  scenario: DbScenario,
  measuredP95: number,
): CheckResult {
  if (measuredP95 <= scenario.budgetMs) {
    return pass(
      `db-${scenario.id}-latency`,
      "db",
      `${scenario.label} p95 latency`,
      `Measured p95 ${measuredP95} ms.`,
      {
        budget: scenario.budgetMs,
        comparison: "lte",
        measured: measuredP95,
        severity: "warn",
        sotaBudget: scenario.sotaMs,
        unit: "ms",
      },
    );
  }

  return warn(
    `db-${scenario.id}-latency`,
    "db",
    `${scenario.label} p95 latency`,
    `Measured p95 ${measuredP95} ms, above budget ${scenario.budgetMs} ms.`,
    {
      budget: scenario.budgetMs,
      comparison: "lte",
      measured: measuredP95,
      sotaBudget: scenario.sotaMs,
      unit: "ms",
    },
  );
}

function buildLiveScenarios(input: {
  entityId: string;
  view: string;
}): DbScenario[] {
  const lowBbox = computeBbox(1.1, 0.42, 1.5);
  const mediumBbox = computeBbox(1.1, 0.42, 4.5);
  const highBbox = computeBbox(1.1, 0.42, 7.2);

  return [
    {
      budgetMs: BUDGETS.dbLatencyMsP95.views,
      id: "views-list",
      label: "views lookup",
      params: [],
      sotaMs: ATLAS_BUDGETS.dbP95Ms.views.sota,
      sql: "select id, slug, name, description from atlas_views order by name",
    },
    {
      budgetMs: BUDGETS.dbLatencyMsP95.views,
      expectedIndexPattern: /atlas_views.*slug|slug/i,
      id: "view-by-slug",
      label: "view lookup by slug",
      maxRows: 1,
      params: [input.view],
      sotaMs: ATLAS_BUDGETS.dbP95Ms.views.sota,
      sql: "select id, slug from atlas_views where slug = $1 limit 1",
    },
    {
      budgetMs: BUDGETS.dbLatencyMsP95.density,
      expectedIndexPattern: /density.*(bounds|z|tile)|atlas_density/i,
      id: "density-bbox",
      label: "density bbox query",
      maxRows: BUDGETS.bounds.maxDensityTilesPerResponse,
      params: [
        input.view,
        lowBbox.minX,
        lowBbox.maxX,
        lowBbox.minY,
        lowBbox.maxY,
        BUDGETS.bounds.maxDensityTilesPerResponse,
      ],
      sotaMs: ATLAS_BUDGETS.dbP95Ms.density.sota,
      sql: `
        select t.id, t.view_id, t.z, t.x_tile, t.y_tile, t.bounds, t.density_payload, t.point_count
        from atlas_density_tiles t
        join atlas_views v on v.id = t.view_id
        where v.slug = $1
          and (t.bounds->>'maxX')::double precision >= $2
          and (t.bounds->>'minX')::double precision <= $3
          and (t.bounds->>'maxY')::double precision >= $4
          and (t.bounds->>'minY')::double precision <= $5
        order by t.point_count desc
        limit $6
      `,
    },
    {
      budgetMs: BUDGETS.dbLatencyMsP95.clusters,
      expectedIndexPattern: /clusters.*(lod|bounds|importance)|atlas_clusters/i,
      id: "clusters-bbox",
      label: "cluster bbox query",
      maxRows: BUDGETS.bounds.maxClustersPerResponse,
      params: [
        input.view,
        mediumBbox.minX,
        mediumBbox.maxX,
        mediumBbox.minY,
        mediumBbox.maxY,
        BUDGETS.bounds.maxClustersPerResponse,
      ],
      sotaMs: ATLAS_BUDGETS.dbP95Ms.clusters.sota,
      sql: `
        select c.id, c.view_id, c.lod_level, c.cluster_id, c.label, c.centroid_x, c.centroid_y,
          c.radius, c.point_count, c.importance, c.bounds_min_x, c.bounds_max_x,
          c.bounds_min_y, c.bounds_max_y, c.color_key
        from atlas_clusters c
        join atlas_views v on v.id = c.view_id
        where v.slug = $1
          and c.lod_level = 1
          and not (
            c.bounds_max_x < $2 or
            c.bounds_min_x > $3 or
            c.bounds_max_y < $4 or
            c.bounds_min_y > $5
          )
        order by c.importance desc, c.point_count desc
        limit $6
      `,
    },
    {
      budgetMs: BUDGETS.dbLatencyMsP95.points,
      expectedIndexPattern: /points.*(xy|importance)|atlas_points/i,
      id: "points-bbox",
      label: "high-zoom point bbox query",
      maxRows: BUDGETS.bounds.maxPointsPerResponse,
      params: [
        input.view,
        highBbox.minX,
        highBbox.maxX,
        highBbox.minY,
        highBbox.maxY,
        BUDGETS.bounds.maxPointsPerResponse,
      ],
      seqScanRelation: "atlas_points",
      sotaMs: ATLAS_BUDGETS.dbP95Ms.points.sota,
      sql: `
        select p.entity_id, p.x, p.y, p.cluster_id, p.label, p.entity_type, p.importance, c.color_key
        from atlas_points p
        join atlas_views v on v.id = p.view_id
        left join atlas_clusters c
          on c.view_id = p.view_id and c.cluster_id = p.cluster_id and c.lod_level = 1
        where v.slug = $1
          and p.x between $2 and $3
          and p.y between $4 and $5
        order by p.importance desc
        limit $6
      `,
    },
    {
      budgetMs: BUDGETS.dbLatencyMsP95.entity,
      expectedIndexPattern: /points.*entity|entity/i,
      id: "entity-lookup",
      label: "entity lookup",
      maxRows: 8,
      params: [input.entityId],
      seqScanRelation: "atlas_points",
      sotaMs: ATLAS_BUDGETS.dbP95Ms.entity.sota,
      sql: `
        select p.id, p.entity_id, p.view_id, v.slug as view_slug, p.x, p.y, p.cluster_id,
          p.label, p.entity_type, p.importance, p.payload_summary, p.metadata
        from atlas_points p
        join atlas_views v on v.id = p.view_id
        where p.entity_id = $1
        order by v.name
      `,
    },
    {
      budgetMs: BUDGETS.dbLatencyMsP95.search,
      expectedIndexPattern: /idx_atlas_points_(label|cluster)_trgm/i,
      id: "search",
      label: "bounded search",
      maxRows: BUDGETS.bounds.maxSearchResults,
      params: [input.view, "graph", BUDGETS.bounds.maxSearchResults],
      seqScanRelation: "atlas_points",
      sotaMs: ATLAS_BUDGETS.dbP95Ms.search.sota,
      sql: `
        select p.entity_id, p.label, p.entity_type, p.x, p.y, p.cluster_id,
          similarity(p.label, $2) as score
        from atlas_points p
        join atlas_views v on v.id = p.view_id
        where v.slug = $1
          and (p.label ilike '%' || $2 || '%' or p.cluster_id ilike '%' || $2 || '%')
        order by score desc, p.importance desc
        limit $3
      `,
    },
  ];
}

export async function dbQueryValidator(
  context: BenchmarkContext,
): Promise<ValidatorResult> {
  const results: CheckResult[] = [];
  const migration001 = "migrations/001_create_atlas_schema.sql";
  const migration002 = "migrations/002_optional_postgis.sql";
  const migration003 = "migrations/003_harden_atlas_indexes.sql";
  const explainSql = "benchmarks/sql/explain-atlas-queries.sql";
  const hasBaselineMigrations =
    existsSync(join(process.cwd(), migration001)) &&
    existsSync(join(process.cwd(), migration003));

  if (hasBaselineMigrations) {
    const schema = `${file(migration001)}\n${file(migration003)}`;
    const hasPointBboxIndex =
      /idx_atlas_points_view_xy/.test(schema) &&
      /idx_atlas_points_view_xy_importance/.test(schema);
    const hasEntityIndex =
      /idx_atlas_points_entity/.test(schema) &&
      /idx_atlas_points_entity_view/.test(schema);
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
      hasEntityIndex
        ? pass(
            "db-point-entity-index",
            "db",
            "Point entity indexes exist",
            "Migrations include entity and entity/view indexes for lazy metadata lookup.",
          )
        : warn(
            "db-point-entity-index",
            "db",
            "Point entity indexes exist",
            "Entity lookup indexes were not detected in migrations.",
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
    existsSync(join(process.cwd(), migration002))
      ? pass(
          "db-postgis-migration-present",
          "db",
          "Optional PostGIS migration exists",
          `${migration002} is present; PostGIS remains optional for local DB benchmarks.`,
          { severity: "warn" },
        )
      : warn(
          "db-postgis-migration-present",
          "db",
          "Optional PostGIS migration exists",
          `${migration002} is missing.`,
        ),
  );

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
        "DATABASE_URL is not configured; run docker-compose.postgres.yml + db:migrate + atlas:seed to enable live DB measurement.",
      ),
    );
    return { validator: "dbQuery", results };
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  try {
    const connectionStartedAt = performance.now();
    await pool.query("select 1");
    const connectionMs = Number((performance.now() - connectionStartedAt).toFixed(2));
    results.push(
      pass(
        "db-live-connection",
        "db",
        "Live database connection works",
        `select 1 completed in ${connectionMs} ms.`,
        { measured: connectionMs, severity: "warn", unit: "ms" },
      ),
    );

    const [viewCount, pointRows, clusterRows, densityRows, hasPostgis] =
      await Promise.all([
        tableCount(pool, "atlas_views"),
        tableCount(pool, "atlas_points"),
        tableCount(pool, "atlas_clusters"),
        tableCount(pool, "atlas_density_tiles"),
        hasExtension(pool, "postgis"),
      ]);

    results.push(
      viewCount > 0 && pointRows > 0
        ? pass(
            "db-live-data-present",
            "db",
            "Live atlas data exists",
            `DB has ${viewCount} views, ${pointRows} point rows, ${clusterRows} clusters, and ${densityRows} density tiles. PostGIS: ${hasPostgis ? "yes" : "no"}.`,
            { measured: pointRows, severity: "warn", unit: "point rows" },
          )
        : fail(
            "db-live-data-present",
            "db",
            "Live atlas data exists",
            `DB has ${viewCount} views and ${pointRows} point rows; run db:migrate and atlas:seed before DB benchmarking.`,
          ),
    );

    if (viewCount === 0 || pointRows === 0) {
      return { validator: "dbQuery", results };
    }

    const viewResult = await pool.query<{ id: string; slug: string }>(
      "select id, slug from atlas_views where slug = $1 limit 1",
      [context.view],
    );
    const selectedView = viewResult.rows[0];
    if (!selectedView) {
      results.push(
        fail(
          "db-live-view-present",
          "db",
          "Configured benchmark view exists",
          `View slug "${context.view}" was not found in atlas_views.`,
        ),
      );
      return { validator: "dbQuery", results };
    }

    const entityResult = await pool.query<{ entity_id: string }>(
      `
        select p.entity_id
        from atlas_points p
        where p.view_id = $1
        order by p.importance desc
        limit 1
      `,
      [selectedView.id],
    );
    const entityId = entityResult.rows[0]?.entity_id;
    if (!entityId) {
      results.push(
        fail(
          "db-live-entity-present",
          "db",
          "Live entity id exists",
          `No entity id found for view "${context.view}".`,
        ),
      );
      return { validator: "dbQuery", results };
    }

    const scenarios = buildLiveScenarios({
      entityId,
      view: context.view,
    });

    for (const scenario of scenarios) {
      const measured = await timeScenario(pool, scenario, context.repetitions);
      results.push(scenarioStatus(scenario, measured.sample.p95));

      if (scenario.maxRows !== undefined) {
        results.push(
          measured.count <= scenario.maxRows
            ? pass(
                `db-${scenario.id}-row-bound`,
                "db",
                `${scenario.label} row bound`,
                `Returned ${measured.count} rows with max ${scenario.maxRows}.`,
                {
                  budget: scenario.maxRows,
                  measured: measured.count,
                  unit: "rows",
                },
              )
            : fail(
                `db-${scenario.id}-row-bound`,
                "db",
                `${scenario.label} row bound`,
                `Returned ${measured.count} rows, exceeding max ${scenario.maxRows}.`,
                {
                  budget: scenario.maxRows,
                  measured: measured.count,
                  unit: "rows",
                },
              ),
        );
      }

      if (scenario.id === "points-bbox") {
        const heavyColumns = measured.columns.filter((column) =>
          ["metadata", "payload_summary"].includes(column),
        );
        results.push(
          heavyColumns.length === 0
            ? pass(
                "db-points-lightweight-projection",
                "db",
                "Point bbox query excludes heavy metadata",
                `Point columns are lightweight: ${measured.columns.join(", ")}.`,
              )
            : fail(
                "db-points-lightweight-projection",
                "db",
                "Point bbox query excludes heavy metadata",
                `Point bbox query includes heavy columns: ${heavyColumns.join(", ")}.`,
              ),
        );
      }

      if (scenario.expectedIndexPattern) {
        const matchedIndex = measured.plan.indexes.find((index) =>
          scenario.expectedIndexPattern?.test(index),
        );
        results.push(
          matchedIndex
            ? pass(
                `db-${scenario.id}-index-plan`,
                "db",
                `${scenario.label} uses expected index`,
                `Plan used ${matchedIndex}.`,
                { severity: "warn" },
              )
            : warn(
                `db-${scenario.id}-index-plan`,
                "db",
                `${scenario.label} uses expected index`,
                `No matching index detected. Plan nodes: ${measured.plan.nodeTypes.join(", ") || "none"}; indexes: ${measured.plan.indexes.join(", ") || "none"}.`,
              ),
        );
      }

      if (
        scenario.seqScanRelation &&
        measured.plan.sequentialRelations.includes(scenario.seqScanRelation)
      ) {
        const detail = `Plan included Seq Scan on ${scenario.seqScanRelation}; point rows=${pointRows}.`;
        results.push(
          pointRows >= ATLAS_BUDGETS.scaleTargets.current.records
            ? fail(
                `db-${scenario.id}-no-point-seq-scan`,
                "db",
                `${scenario.label} avoids atlas_points sequential scan`,
                detail,
              )
            : warn(
                `db-${scenario.id}-no-point-seq-scan`,
                "db",
                `${scenario.label} avoids atlas_points sequential scan`,
                `${detail} Below current-scale target, so this is a warning until seeded at ${ATLAS_BUDGETS.scaleTargets.current.records} records.`,
              ),
        );
      } else if (scenario.seqScanRelation) {
        results.push(
          pass(
            `db-${scenario.id}-no-point-seq-scan`,
            "db",
            `${scenario.label} avoids atlas_points sequential scan`,
            `No Seq Scan on ${scenario.seqScanRelation}. Plan indexes: ${measured.plan.indexes.join(", ") || "none"}.`,
            { severity: "warn" },
          ),
        );
      }
    }
  } catch (error) {
    results.push(
      fail(
        "db-live-query-error",
        "db",
        "Live database query benchmark runs",
        error instanceof Error ? error.message : String(error),
      ),
    );
  } finally {
    await pool.end().catch(() => undefined);
  }

  return { validator: "dbQuery", results };
}
