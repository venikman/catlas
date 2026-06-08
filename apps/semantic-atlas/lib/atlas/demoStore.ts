import { ATLAS_LOD_CONFIG } from "./lod";
import { bboxContainsPoint, bboxIntersects } from "./math";
import { createSyntheticAtlasBatch } from "./syntheticData";
import type {
  AtlasBbox,
  AtlasCluster,
  AtlasDensityTile,
  AtlasEntityDetails,
  AtlasPoint,
  AtlasSearchResult,
  AtlasView,
} from "./types";

const DEMO_ENTITY_COUNT = 42_608;

let cachedBatch: ReturnType<typeof createSyntheticAtlasBatch> | null = null;

function batch() {
  cachedBatch ??= createSyntheticAtlasBatch({
    count: DEMO_ENTITY_COUNT,
    seed: 170_432,
  });
  return cachedBatch;
}

export function isDemoAtlasEnabled(): boolean {
  return (
    process.env.ATLAS_DEMO_MODE === "true" ||
    (process.env.NODE_ENV === "development" && !process.env.DATABASE_URL)
  );
}

export function demoDatasetStats() {
  const data = batch();
  return {
    source: "demo",
    entityCount: DEMO_ENTITY_COUNT,
    pointRows: data.points.length,
  };
}

export function listDemoViews(): AtlasView[] {
  return batch().views;
}

export function listDemoPoints(input: {
  view: string;
  bbox: AtlasBbox;
  limit?: number;
}): AtlasPoint[] {
  return batch()
    .points.filter(
      (point) =>
        point.viewSlug === input.view && bboxContainsPoint(input.bbox, point),
    )
    .sort((a, b) => b.importance - a.importance)
    .slice(0, input.limit ?? ATLAS_LOD_CONFIG.maxPoints);
}

export function listDemoClusters(input: {
  view: string;
  bbox: AtlasBbox;
  limit?: number;
}): AtlasCluster[] {
  return batch()
    .clusters.filter(
      (cluster) =>
        cluster.viewSlug === input.view &&
        bboxIntersects(input.bbox, {
          minX: cluster.boundsMinX,
          maxX: cluster.boundsMaxX,
          minY: cluster.boundsMinY,
          maxY: cluster.boundsMaxY,
        }),
    )
    .sort((a, b) => b.importance - a.importance || b.pointCount - a.pointCount)
    .slice(0, input.limit ?? ATLAS_LOD_CONFIG.maxClusters);
}

export function listDemoDensityTiles(input: {
  view: string;
  bbox: AtlasBbox;
  limit?: number;
}): AtlasDensityTile[] {
  return batch()
    .densityTiles.filter(
      (tile) =>
        tile.viewSlug === input.view && bboxIntersects(input.bbox, tile.bounds),
    )
    .sort((a, b) => b.pointCount - a.pointCount)
    .slice(0, input.limit ?? ATLAS_LOD_CONFIG.maxDensityTiles);
}

export function getDemoEntity(entityId: string): AtlasEntityDetails | null {
  const rows = batch().points.filter((point) => point.entityId === entityId);
  if (rows.length === 0) {
    return null;
  }

  const first = rows[0];
  return {
    entityId,
    label: first.label.replace(/\s+\d+$/, ""),
    entityType: first.entityType,
    payloadSummary: first.payloadSummary ?? "",
    metadata: {
      ...first.metadata,
      source: "development demo dataset",
      rows: rows.length,
    },
    views: rows.map((row) => ({
      viewId: row.viewId ?? "",
      viewSlug: row.viewSlug,
      x: row.x,
      y: row.y,
      clusterId: row.clusterId,
    })),
  };
}

export function searchDemoAtlas(input: {
  view: string;
  q: string;
  limit?: number;
}): AtlasSearchResult[] {
  const normalized = input.q.toLowerCase();
  const limit = input.limit ?? ATLAS_LOD_CONFIG.maxSearchResults;
  return batch()
    .points.filter(
      (point) =>
        point.viewSlug === input.view &&
        `${point.label} ${point.clusterId} ${point.entityType}`
          .toLowerCase()
          .includes(normalized),
    )
    .sort((a, b) => b.importance - a.importance)
    .slice(0, limit)
    .map((point) => ({
      entityId: point.entityId,
      label: point.label.replace(/\s+\d+$/, ""),
      entityType: point.entityType,
      x: point.x,
      y: point.y,
      clusterId: point.clusterId,
      score: point.importance,
    }));
}
