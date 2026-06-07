import type { AtlasCluster, AtlasPoint } from "./types";

const MAX_POINT_LABEL_LENGTH = 96;
const COORD_PRECISION = 4;
const IMPORTANCE_PRECISION = 3;

export function truncateAtlasLabel(label: string): string {
  if (label.length <= MAX_POINT_LABEL_LENGTH) return label;
  return `${label.slice(0, MAX_POINT_LABEL_LENGTH - 3)}...`;
}

function roundTo(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

function roundCoord(value: number): number {
  return roundTo(value, COORD_PRECISION);
}

function roundImportance(value: number): number {
  return roundTo(value, IMPORTANCE_PRECISION);
}

export function lightweightPoint(point: AtlasPoint): AtlasPoint {
  return {
    entityId: point.entityId,
    x: roundCoord(point.x),
    y: roundCoord(point.y),
    clusterId: point.clusterId,
    label: truncateAtlasLabel(point.label),
    entityType: point.entityType,
    importance: roundImportance(point.importance),
    colorKey: point.colorKey,
  };
}

export function lightweightPoints(points: AtlasPoint[]): AtlasPoint[] {
  return points.map(lightweightPoint);
}

export function lightweightCluster(cluster: AtlasCluster): AtlasCluster {
  return {
    id: cluster.id,
    viewId: cluster.viewId,
    viewSlug: cluster.viewSlug,
    lodLevel: cluster.lodLevel,
    clusterId: cluster.clusterId,
    label: truncateAtlasLabel(cluster.label),
    centroidX: roundCoord(cluster.centroidX),
    centroidY: roundCoord(cluster.centroidY),
    radius: roundCoord(cluster.radius),
    pointCount: cluster.pointCount,
    importance: roundImportance(cluster.importance),
    boundsMinX: roundCoord(cluster.boundsMinX),
    boundsMaxX: roundCoord(cluster.boundsMaxX),
    boundsMinY: roundCoord(cluster.boundsMinY),
    boundsMaxY: roundCoord(cluster.boundsMaxY),
    colorKey: cluster.colorKey,
  };
}

export function lightweightClusters(clusters: AtlasCluster[]): AtlasCluster[] {
  return clusters.map(lightweightCluster);
}

export function isTruncated(count: number, limit: number): boolean {
  return count >= limit;
}
