import pg from "pg";
import { ATLAS_LOD_CONFIG } from "./lod";
import {
  demoDatasetStats,
  getDemoEntity,
  isDemoAtlasEnabled,
  listDemoClusters,
  listDemoDensityTiles,
  listDemoPoints,
  listDemoViews,
  searchDemoAtlas,
} from "./demoStore";
import type {
  AtlasBbox,
  AtlasCluster,
  AtlasDensityTile,
  AtlasEntityDetails,
  AtlasPoint,
  AtlasSearchResult,
  AtlasView,
} from "./types";

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool | null {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

  return pool;
}

function requirePool(): pg.Pool {
  const activePool = getPool();
  if (!activePool) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return activePool;
}

function mapView(row: Record<string, unknown>): AtlasView {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function mapPoint(row: Record<string, unknown>): AtlasPoint {
  return {
    id: String(row.id),
    entityId: String(row.entity_id),
    viewId: String(row.view_id),
    viewSlug: row.view_slug ? String(row.view_slug) : undefined,
    x: Number(row.x),
    y: Number(row.y),
    clusterId: String(row.cluster_id),
    label: String(row.label),
    entityType: String(row.entity_type),
    importance: Number(row.importance),
    payloadSummary: String(row.payload_summary ?? ""),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    colorKey: row.color_key ? String(row.color_key) : undefined,
  };
}

function mapCluster(row: Record<string, unknown>): AtlasCluster {
  return {
    id: String(row.id),
    viewId: String(row.view_id),
    viewSlug: row.view_slug ? String(row.view_slug) : undefined,
    lodLevel: Number(row.lod_level),
    clusterId: String(row.cluster_id),
    label: String(row.label),
    centroidX: Number(row.centroid_x),
    centroidY: Number(row.centroid_y),
    radius: Number(row.radius),
    pointCount: Number(row.point_count),
    importance: Number(row.importance),
    boundsMinX: Number(row.bounds_min_x),
    boundsMaxX: Number(row.bounds_max_x),
    boundsMinY: Number(row.bounds_min_y),
    boundsMaxY: Number(row.bounds_max_y),
    colorKey: String(row.color_key),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

function mapDensityTile(row: Record<string, unknown>): AtlasDensityTile {
  const bounds = row.bounds as AtlasDensityTile["bounds"];
  const densityPayload =
    row.density_payload as AtlasDensityTile["densityPayload"];
  return {
    id: String(row.id),
    viewId: String(row.view_id),
    viewSlug: row.view_slug ? String(row.view_slug) : undefined,
    z: Number(row.z),
    xTile: Number(row.x_tile),
    yTile: Number(row.y_tile),
    bounds,
    densityPayload,
    pointCount: Number(row.point_count),
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

export function getAtlasSourceMode(): "postgres" | "demo" | "unavailable" {
  if (getPool()) return "postgres";
  if (isDemoAtlasEnabled()) return "demo";
  return "unavailable";
}

export async function getAtlasStats() {
  if (getAtlasSourceMode() === "demo") {
    return demoDatasetStats();
  }

  if (getAtlasSourceMode() === "postgres") {
    const activePool = requirePool();
    const result = await activePool.query<{
      entity_count: string;
      point_rows: string;
    }>(
      "select count(distinct entity_id) as entity_count, count(*) as point_rows from atlas_points",
    );
    return {
      source: "postgres",
      entityCount: Number(result.rows[0]?.entity_count ?? 0),
      pointRows: Number(result.rows[0]?.point_rows ?? 0),
    };
  }

  return { source: "unavailable", entityCount: 0, pointRows: 0 };
}

export async function listAtlasViews(): Promise<AtlasView[]> {
  if (getAtlasSourceMode() === "demo") return listDemoViews();

  const activePool = requirePool();
  const result = await activePool.query(
    "select id::text, slug, name, description, created_at, updated_at from atlas_views order by name",
  );
  return result.rows.map(mapView);
}

export async function listAtlasPoints(input: {
  view: string;
  bbox: AtlasBbox;
  limit?: number;
}): Promise<AtlasPoint[]> {
  if (getAtlasSourceMode() === "demo") return listDemoPoints(input);

  const activePool = requirePool();
  const result = await activePool.query(
    `
      select
        p.id::text,
        p.entity_id,
        p.view_id::text,
        v.slug as view_slug,
        p.x,
        p.y,
        p.cluster_id,
        p.label,
        p.entity_type,
        p.importance,
        p.payload_summary,
        p.metadata,
        c.color_key
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
    [
      input.view,
      input.bbox.minX,
      input.bbox.maxX,
      input.bbox.minY,
      input.bbox.maxY,
      input.limit ?? ATLAS_LOD_CONFIG.maxPoints,
    ],
  );
  return result.rows.map(mapPoint);
}

export async function listAtlasClusters(input: {
  view: string;
  bbox: AtlasBbox;
  limit?: number;
}): Promise<AtlasCluster[]> {
  if (getAtlasSourceMode() === "demo") return listDemoClusters(input);

  const activePool = requirePool();
  const result = await activePool.query(
    `
      select
        c.id::text,
        c.view_id::text,
        v.slug as view_slug,
        c.lod_level,
        c.cluster_id,
        c.label,
        c.centroid_x,
        c.centroid_y,
        c.radius,
        c.point_count,
        c.importance,
        c.bounds_min_x,
        c.bounds_max_x,
        c.bounds_min_y,
        c.bounds_max_y,
        c.color_key,
        c.metadata
      from atlas_clusters c
      join atlas_views v on v.id = c.view_id
      where v.slug = $1
        and not (
          c.bounds_max_x < $2 or
          c.bounds_min_x > $3 or
          c.bounds_max_y < $4 or
          c.bounds_min_y > $5
        )
      order by c.importance desc, c.point_count desc
      limit $6
    `,
    [
      input.view,
      input.bbox.minX,
      input.bbox.maxX,
      input.bbox.minY,
      input.bbox.maxY,
      input.limit ?? ATLAS_LOD_CONFIG.maxClusters,
    ],
  );
  return result.rows.map(mapCluster);
}

export async function listAtlasDensityTiles(input: {
  view: string;
  bbox: AtlasBbox;
  limit?: number;
}): Promise<AtlasDensityTile[]> {
  if (getAtlasSourceMode() === "demo") return listDemoDensityTiles(input);

  const activePool = requirePool();
  const result = await activePool.query(
    `
      select
        t.id::text,
        t.view_id::text,
        v.slug as view_slug,
        t.z,
        t.x_tile,
        t.y_tile,
        t.bounds,
        t.density_payload,
        t.point_count,
        t.created_at
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
    [
      input.view,
      input.bbox.minX,
      input.bbox.maxX,
      input.bbox.minY,
      input.bbox.maxY,
      input.limit ?? ATLAS_LOD_CONFIG.maxDensityTiles,
    ],
  );
  return result.rows.map(mapDensityTile);
}

export async function getAtlasEntity(
  entityId: string,
): Promise<AtlasEntityDetails | null> {
  if (getAtlasSourceMode() === "demo") return getDemoEntity(entityId);

  const activePool = requirePool();
  const result = await activePool.query(
    `
      select
        p.id::text,
        p.entity_id,
        p.view_id::text,
        v.slug as view_slug,
        p.x,
        p.y,
        p.cluster_id,
        p.label,
        p.entity_type,
        p.importance,
        p.payload_summary,
        p.metadata
      from atlas_points p
      join atlas_views v on v.id = p.view_id
      where p.entity_id = $1
      order by v.name
    `,
    [entityId],
  );

  if (result.rows.length === 0) return null;
  const rows = result.rows.map(mapPoint);
  const first = rows[0];
  return {
    entityId,
    label: first.label,
    entityType: first.entityType,
    payloadSummary: first.payloadSummary,
    metadata: first.metadata ?? {},
    views: rows.map((row) => ({
      viewId: row.viewId,
      viewSlug: row.viewSlug,
      x: row.x,
      y: row.y,
      clusterId: row.clusterId,
    })),
  };
}

export async function searchAtlas(input: {
  view: string;
  q: string;
  limit?: number;
}): Promise<AtlasSearchResult[]> {
  if (getAtlasSourceMode() === "demo") return searchDemoAtlas(input);

  const activePool = requirePool();
  const result = await activePool.query(
    `
      select
        p.entity_id,
        p.label,
        p.entity_type,
        p.x,
        p.y,
        p.cluster_id,
        similarity(p.label, $2) as score
      from atlas_points p
      join atlas_views v on v.id = p.view_id
      where v.slug = $1
        and (p.label ilike '%' || $2 || '%' or p.cluster_id ilike '%' || $2 || '%')
      order by score desc, p.importance desc
      limit $3
    `,
    [input.view, input.q, input.limit ?? ATLAS_LOD_CONFIG.maxSearchResults],
  );

  return result.rows.map((row) => ({
    entityId: String(row.entity_id),
    label: String(row.label),
    entityType: String(row.entity_type),
    x: Number(row.x),
    y: Number(row.y),
    clusterId: String(row.cluster_id),
    score: Number(row.score ?? 0),
  }));
}
