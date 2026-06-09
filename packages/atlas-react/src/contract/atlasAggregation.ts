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
  worldBounds?: AtlasWorldBounds;
  labelForCluster?: (clusterId: string, points: AtlasPoint[]) => string;
  colorKeyForCluster?: (clusterId: string, points: AtlasPoint[]) => string;
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

function rounded(value: number, digits = 5): number {
  return Number(value.toFixed(digits));
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function viewIdFor(point: AtlasPoint, fallback?: string): string {
  return point.viewId ?? fallback ?? DEFAULT_VIEW_ID;
}

function viewSlugFor(point: AtlasPoint, fallback?: string): string | undefined {
  return point.viewSlug ?? fallback;
}

function labelFromClusterId(clusterId: string): string {
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
  options: AtlasClusterAggregationOptions = {},
): AtlasCluster[] {
  const lodLevel = options.lodLevel ?? 1;
  assertWorldBounds(options.worldBounds ?? ATLAS_DEFAULT_WORLD_BOUNDS);
  if (!Number.isInteger(lodLevel) || lodLevel < 0) {
    throw new Error("lodLevel must be a non-negative integer.");
  }

  const groups = new Map<string, AtlasPoint[]>();
  for (const point of points) {
    const viewId = viewIdFor(point, options.viewId);
    const key = `${viewId}:${point.clusterId}`;
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
      const xs = clusterPoints.map((point) => point.x);
      const ys = clusterPoints.map((point) => point.y);
      const boundsMinX = Math.min(...xs);
      const boundsMaxX = Math.max(...xs);
      const boundsMinY = Math.min(...ys);
      const boundsMaxY = Math.max(...ys);
      const radius =
        Math.max(boundsMaxX - boundsMinX, boundsMaxY - boundsMinY, 0.01) / 2;

      return {
        boundsMaxX: rounded(boundsMaxX),
        boundsMaxY: rounded(boundsMaxY),
        boundsMinX: rounded(boundsMinX),
        boundsMinY: rounded(boundsMinY),
        centroidX: rounded(average(xs)),
        centroidY: rounded(average(ys)),
        clusterId,
        colorKey:
          options.colorKeyForCluster?.(clusterId, clusterPoints) ??
          first.colorKey ??
          DEFAULT_COLOR_KEY,
        id: `${viewId}-${clusterId}-lod-${lodLevel}`,
        importance: rounded(
          average(clusterPoints.map((point) => point.importance)),
          4,
        ),
        label:
          options.labelForCluster?.(clusterId, clusterPoints) ??
          labelFromClusterId(clusterId),
        lodLevel,
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
  options: AtlasDensityTileOptions = {},
): AtlasDensityTile[] {
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
    const key = `${viewId}:${z}:${xTile}:${yTile}:${point.clusterId}`;
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
