import type {
  AtlasCluster,
  AtlasDensityTile,
  AtlasPoint,
} from "../lib/atlas/types";
import {
  ATLAS_DEFAULT_WORLD_BOUNDS,
  type AtlasWorldBounds,
} from "./atlasStore";

export type AtlasClusterAggregationOptions = {
  viewId?: string;
  viewSlug?: string;
  lodLevel?: number;
  minRadius?: number;
  worldBounds?: AtlasWorldBounds;
  labelForCluster?: (clusterId: string, points: AtlasPoint[]) => string;
  colorKeyForCluster?: (clusterId: string, points: AtlasPoint[]) => string;
  metadataForCluster?: (
    clusterId: string,
    points: AtlasPoint[],
  ) => Record<string, unknown> | undefined;
};

export type AtlasDensityTileOptions = {
  viewId?: string;
  viewSlug?: string;
  worldBounds?: AtlasWorldBounds;
  tileCount?: number;
  z?: number;
  maxPointsPerTile?: number;
};

const DEFAULT_VIEW_ID = "atlas-view";
const DEFAULT_COLOR_KEY = "#64748b";
const DEFAULT_TILE_COUNT = 8;
const DEFAULT_DENSITY_Z = 2;
const DEFAULT_MAX_POINTS_PER_TILE = 40;
const DEFAULT_MIN_CLUSTER_RADIUS = 0.15;

function rounded(value: number, digits = 5): number {
  return Number(value.toFixed(digits));
}

function viewIdFor(point: AtlasPoint, fallback?: string): string {
  return point.viewId ?? fallback ?? DEFAULT_VIEW_ID;
}

function viewSlugFor(point: AtlasPoint, fallback?: string): string | undefined {
  return point.viewSlug ?? fallback;
}

function labelFromClusterId(clusterId: string): string {
  if (typeof clusterId !== "string" || clusterId.length === 0) return "";
  return clusterId
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function assertPositiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function assertWorldBounds(worldBounds: AtlasWorldBounds): AtlasWorldBounds {
  if (
    !Number.isFinite(worldBounds.minX) ||
    !Number.isFinite(worldBounds.maxX) ||
    !Number.isFinite(worldBounds.minY) ||
    !Number.isFinite(worldBounds.maxY) ||
    worldBounds.minX >= worldBounds.maxX ||
    worldBounds.minY >= worldBounds.maxY
  ) {
    throw new Error("worldBounds must contain finite increasing min/max values.");
  }
  return worldBounds;
}

function assertPointWithinWorldBounds(
  point: AtlasPoint,
  worldBounds: AtlasWorldBounds,
): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new Error("Atlas point coordinates must be finite numbers.");
  }
  if (
    point.x < worldBounds.minX ||
    point.x > worldBounds.maxX ||
    point.y < worldBounds.minY ||
    point.y > worldBounds.maxY
  ) {
    throw new Error(`Atlas point ${point.entityId} is outside worldBounds.`);
  }
}

function tileIndex(
  coordinate: number,
  min: number,
  tileSize: number,
  tileCount: number,
): number {
  return Math.max(
    0,
    Math.min(tileCount - 1, Math.floor((coordinate - min) / tileSize)),
  );
}

export function aggregateClusters(
  points: AtlasPoint[],
  options: AtlasClusterAggregationOptions | null = {},
): AtlasCluster[] {
  if (!Array.isArray(points)) return [];
  options ??= {};
  const lodLevel = options.lodLevel ?? 1;
  const minRadius = options.minRadius ?? DEFAULT_MIN_CLUSTER_RADIUS;
  const worldBounds = assertWorldBounds(
    options.worldBounds ?? ATLAS_DEFAULT_WORLD_BOUNDS,
  );
  if (!Number.isInteger(lodLevel) || lodLevel < 0) {
    throw new Error("lodLevel must be a non-negative integer.");
  }
  if (!Number.isFinite(minRadius) || minRadius < 0) {
    throw new Error("minRadius must be a non-negative finite number.");
  }

  const groups = new Map<string, AtlasPoint[]>();
  for (const point of points) {
    assertPointWithinWorldBounds(point, worldBounds);
    const viewId = viewIdFor(point, options.viewId);
    const key = JSON.stringify([viewId, point.clusterId]);
    const group = groups.get(key);
    if (group) {
      group.push(point);
    } else {
      groups.set(key, [point]);
    }
  }

  return Array.from(groups.values())
    .map((clusterPoints): AtlasCluster => {
      const first = clusterPoints[0];
      const viewId = viewIdFor(first, options.viewId);
      const viewSlug = viewSlugFor(first, options.viewSlug);
      const clusterId = first.clusterId;
      let boundsMinX = first.x;
      let boundsMaxX = first.x;
      let boundsMinY = first.y;
      let boundsMaxY = first.y;
      let sumX = 0;
      let sumY = 0;
      let sumImportance = 0;
      for (const point of clusterPoints) {
        boundsMinX = Math.min(boundsMinX, point.x);
        boundsMaxX = Math.max(boundsMaxX, point.x);
        boundsMinY = Math.min(boundsMinY, point.y);
        boundsMaxY = Math.max(boundsMaxY, point.y);
        sumX += point.x;
        sumY += point.y;
        sumImportance += point.importance;
      }
      const radius = Math.max(
        Math.max(boundsMaxX - boundsMinX, boundsMaxY - boundsMinY) / 2,
        minRadius,
      );
      const metadata = options.metadataForCluster?.(clusterId, clusterPoints);

      return {
        boundsMaxX: rounded(boundsMaxX),
        boundsMaxY: rounded(boundsMaxY),
        boundsMinX: rounded(boundsMinX),
        boundsMinY: rounded(boundsMinY),
        centroidX: rounded(sumX / clusterPoints.length),
        centroidY: rounded(sumY / clusterPoints.length),
        clusterId,
        colorKey:
          options.colorKeyForCluster?.(clusterId, clusterPoints) ??
          first.colorKey ??
          DEFAULT_COLOR_KEY,
        id: `${viewId}-${clusterId}-lod-${lodLevel}`,
        importance: rounded(sumImportance / clusterPoints.length, 4),
        label:
          options.labelForCluster?.(clusterId, clusterPoints) ??
          labelFromClusterId(clusterId),
        lodLevel,
        metadata,
        pointCount: clusterPoints.length,
        radius: rounded(radius),
        viewId,
        viewSlug,
      };
    })
    .sort((left, right) => {
      if (left.viewId !== right.viewId) return left.viewId.localeCompare(right.viewId);
      if (right.importance !== left.importance) return right.importance - left.importance;
      return left.clusterId.localeCompare(right.clusterId);
    });
}

export function buildDensityTiles(
  points: AtlasPoint[],
  options: AtlasDensityTileOptions | null = {},
): AtlasDensityTile[] {
  if (!Array.isArray(points)) return [];
  options ??= {};
  const worldBounds = assertWorldBounds(
    options.worldBounds ?? ATLAS_DEFAULT_WORLD_BOUNDS,
  );
  const tileCount = assertPositiveInteger(
    options.tileCount ?? DEFAULT_TILE_COUNT,
    "tileCount",
  );
  const z = options.z ?? DEFAULT_DENSITY_Z;
  if (!Number.isInteger(z) || z < 0) {
    throw new Error("z must be a non-negative integer.");
  }

  const maxPointsPerTile = assertPositiveInteger(
    options.maxPointsPerTile ?? DEFAULT_MAX_POINTS_PER_TILE,
    "maxPointsPerTile",
  );
  const tileSizeX = (worldBounds.maxX - worldBounds.minX) / tileCount;
  const tileSizeY = (worldBounds.maxY - worldBounds.minY) / tileCount;
  const tiles = new Map<string, AtlasDensityTile>();

  for (const point of points) {
    const xTile = tileIndex(point.x, worldBounds.minX, tileSizeX, tileCount);
    const yTile = tileIndex(point.y, worldBounds.minY, tileSizeY, tileCount);
    const viewId = viewIdFor(point, options.viewId);
    const viewSlug = viewSlugFor(point, options.viewSlug);
    const key = JSON.stringify([viewId, z, xTile, yTile, point.clusterId]);
    const existing = tiles.get(key);
    const densityPoint = {
      weight: rounded(0.35 + point.importance, 3),
      x: rounded(point.x),
      y: rounded(point.y),
    };

    if (existing) {
      existing.pointCount += 1;
      if (existing.densityPayload.points.length < maxPointsPerTile) {
        existing.densityPayload.points.push(densityPoint);
      }
      continue;
    }

    tiles.set(key, {
      bounds: {
        minX: rounded(worldBounds.minX + xTile * tileSizeX),
        maxX: rounded(worldBounds.minX + (xTile + 1) * tileSizeX),
        minY: rounded(worldBounds.minY + yTile * tileSizeY),
        maxY: rounded(worldBounds.minY + (yTile + 1) * tileSizeY),
      },
      densityPayload: {
        colorKey: point.colorKey ?? DEFAULT_COLOR_KEY,
        label: labelFromClusterId(point.clusterId),
        points: [densityPoint],
      },
      id: `${viewId}-tile-${z}-${xTile}-${yTile}-${point.clusterId}`,
      pointCount: 1,
      viewId,
      viewSlug,
      xTile,
      yTile,
      z,
    });
  }

  return Array.from(tiles.values()).sort((left, right) => {
    if (left.viewId !== right.viewId) return left.viewId.localeCompare(right.viewId);
    if (left.z !== right.z) return left.z - right.z;
    if (left.xTile !== right.xTile) return left.xTile - right.xTile;
    if (left.yTile !== right.yTile) return left.yTile - right.yTile;
    return left.id.localeCompare(right.id);
  });
}
