import { spawnSync } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import pg from "pg";

const { Pool } = pg;

function arg(name: string, fallback?: string): string | undefined {
  const direct = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  if (direct) return direct.split("=").slice(1).join("=");
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const count = arg("count");
const file = arg(
  "file",
  count
    ? `.atlas-data/synthetic-atlas-${count}.jsonl`
    : ".atlas-data/synthetic-atlas-10000.jsonl",
);
const batchSize = Number.parseInt(arg("batchSize", "500") ?? "500", 10);
const generateBatchSize = arg("generateBatchSize", "5000") ?? "5000";
const seed = arg("seed", "170431") ?? "170431";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for seed:atlas.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const pointRows: unknown[] = [];
const clusterRows: unknown[] = [];
const densityRows: unknown[] = [];
let inserted = 0;

function ensureGeneratedFile() {
  if (!count || !file || (existsSync(file) && !flag("regenerate"))) return;

  const tsx = join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "tsx.cmd" : "tsx",
  );
  const result = spawnSync(
    tsx,
    [
      "scripts/generate-atlas.ts",
      "--count",
      count,
      "--out",
      file,
      "--batchSize",
      generateBatchSize,
      "--seed",
      seed,
    ],
    { stdio: "inherit" },
  );

  if (result.status !== 0) {
    throw new Error(`Synthetic atlas generation failed with status ${result.status}.`);
  }
}

async function resetAtlasTables() {
  if (!flag("reset")) return;
  if (!flag("yes")) {
    throw new Error("Refusing destructive reset. Re-run with --reset --yes.");
  }

  await pool.query(
    "truncate atlas_density_tiles, atlas_clusters, atlas_points, atlas_views cascade",
  );
  console.log("Reset atlas tables.");
}

async function flushPoints() {
  if (pointRows.length === 0) return;
  const values = pointRows.splice(0, pointRows.length) as Array<Record<string, unknown>>;
  const placeholders = values
    .map(
      (_, index) =>
        `($${index * 11 + 1}, $${index * 11 + 2}, $${index * 11 + 3}, $${index * 11 + 4}, $${index * 11 + 5}, $${index * 11 + 6}, $${index * 11 + 7}, $${index * 11 + 8}, $${index * 11 + 9}, $${index * 11 + 10}, $${index * 11 + 11}::jsonb)`,
    )
    .join(",");
  await pool.query(
    `
      insert into atlas_points
        (id, entity_id, view_id, x, y, cluster_id, label, entity_type, importance, payload_summary, metadata)
      values ${placeholders}
      on conflict (entity_id, view_id) do update set
        x = excluded.x,
        y = excluded.y,
        cluster_id = excluded.cluster_id,
        label = excluded.label,
        entity_type = excluded.entity_type,
        importance = excluded.importance,
        payload_summary = excluded.payload_summary,
        metadata = excluded.metadata,
        updated_at = now()
    `,
    values.flatMap((point) => [
      point.id,
      point.entityId,
      point.viewId,
      point.x,
      point.y,
      point.clusterId,
      point.label,
      point.entityType,
      point.importance,
      point.payloadSummary,
      JSON.stringify(point.metadata ?? {}),
    ]),
  );
  inserted += values.length;
  process.stdout.write(`inserted ${inserted.toLocaleString()} point rows\r`);
}

async function flushClusters() {
  if (clusterRows.length === 0) return;
  const values = clusterRows.splice(0, clusterRows.length) as Array<Record<string, unknown>>;
  for (const cluster of values) {
    await pool.query(
      `
        insert into atlas_clusters
          (id, view_id, lod_level, cluster_id, label, centroid_x, centroid_y, radius, point_count, importance, bounds_min_x, bounds_max_x, bounds_min_y, bounds_max_y, color_key, metadata)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
        on conflict (view_id, lod_level, cluster_id) do update set
          label = excluded.label,
          centroid_x = excluded.centroid_x,
          centroid_y = excluded.centroid_y,
          radius = excluded.radius,
          point_count = excluded.point_count,
          importance = excluded.importance,
          bounds_min_x = excluded.bounds_min_x,
          bounds_max_x = excluded.bounds_max_x,
          bounds_min_y = excluded.bounds_min_y,
          bounds_max_y = excluded.bounds_max_y,
          color_key = excluded.color_key,
          metadata = excluded.metadata
      `,
      [
        cluster.id,
        cluster.viewId,
        cluster.lodLevel,
        cluster.clusterId,
        cluster.label,
        cluster.centroidX,
        cluster.centroidY,
        cluster.radius,
        cluster.pointCount,
        cluster.importance,
        cluster.boundsMinX,
        cluster.boundsMaxX,
        cluster.boundsMinY,
        cluster.boundsMaxY,
        cluster.colorKey,
        JSON.stringify(cluster.metadata ?? {}),
      ],
    );
  }
}

async function flushDensity() {
  if (densityRows.length === 0) return;
  const values = densityRows.splice(0, densityRows.length) as Array<Record<string, unknown>>;
  for (const tile of values) {
    await pool.query(
      `
        insert into atlas_density_tiles
          (id, view_id, z, x_tile, y_tile, bounds, density_payload, point_count)
        values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8)
        on conflict (view_id, z, x_tile, y_tile) do update set
          bounds = excluded.bounds,
          density_payload = excluded.density_payload,
          point_count = excluded.point_count
      `,
      [
        tile.id,
        tile.viewId,
        tile.z,
        tile.xTile,
        tile.yTile,
        JSON.stringify(tile.bounds),
        JSON.stringify(tile.densityPayload),
        tile.pointCount,
      ],
    );
  }
}

async function analyzeAtlasTables() {
  await pool.query(
    "analyze atlas_views; analyze atlas_points; analyze atlas_clusters; analyze atlas_density_tiles",
  );
}

async function run() {
  ensureGeneratedFile();
  await resetAtlasTables();

  const rl = createInterface({
    input: createReadStream(file ?? ""),
    crlfDelay: Number.POSITIVE_INFINITY,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    const record = JSON.parse(line) as { type: string; payload: Record<string, unknown> };
    if (record.type === "view") {
      await pool.query(
        `
          insert into atlas_views (id, slug, name, description)
          values ($1,$2,$3,$4)
          on conflict (slug) do update set
            name = excluded.name,
            description = excluded.description,
            updated_at = now()
        `,
        [
          record.payload.id,
          record.payload.slug,
          record.payload.name,
          record.payload.description ?? null,
        ],
      );
    } else if (record.type === "point") {
      pointRows.push(record.payload);
      if (pointRows.length >= batchSize) await flushPoints();
    } else if (record.type === "cluster") {
      clusterRows.push(record.payload);
    } else if (record.type === "density_tile") {
      densityRows.push(record.payload);
    }
  }

  await flushPoints();
  await flushClusters();
  await flushDensity();
  await analyzeAtlasTables();
  await pool.end();
  process.stdout.write("\n");
  console.log("Seed complete.");
}

run().catch(async (error) => {
  await pool.end();
  console.error(error);
  process.exit(1);
});
