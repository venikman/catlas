import type { AtlasCluster, AtlasEntityDetails, AtlasPoint } from "./types";

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

export type LightweightEntityOptions = {
  /**
   * Allow-list of `metadata` keys to expose. Omit to pass all keys through (the
   * reference default — its data is synthetic). Adopters serving real records set
   * this so anonymous, CDN-cacheable responses only carry fields safe to publish.
   * This is the field boundary from CONTRACT §5 — it controls the *contents* of the
   * metadata bag, which `AtlasEntityDetails` requires to exist but never to be filled.
   */
  metadataAllowList?: readonly string[];
  /** Set false to drop `payloadSummary` for anonymous responses. Default true. */
  includePayloadSummary?: boolean;
};

/**
 * Serving-layer projection for a single entity — mirrors `lightweightPoint` /
 * `lightweightCluster`. Returns a valid `AtlasEntityDetails` (the renderer's inspector
 * needs the shape) while letting the adopter trim what actually crosses the boundary.
 */
export function lightweightEntity(
  entity: AtlasEntityDetails,
  options: LightweightEntityOptions = {},
): AtlasEntityDetails {
  const { metadataAllowList, includePayloadSummary = true } = options;
  const metadata = metadataAllowList
    ? Object.fromEntries(
        Object.entries(entity.metadata).filter(([key]) =>
          metadataAllowList.includes(key),
        ),
      )
    : entity.metadata;
  return {
    entityId: entity.entityId,
    label: truncateAtlasLabel(entity.label),
    entityType: entity.entityType,
    payloadSummary: includePayloadSummary ? entity.payloadSummary : "",
    metadata,
    views: entity.views.map((view) => ({
      viewId: view.viewId,
      viewSlug: view.viewSlug,
      x: roundCoord(view.x),
      y: roundCoord(view.y),
      clusterId: view.clusterId,
    })),
  };
}

export function isTruncated(count: number, limit: number): boolean {
  return count >= limit;
}
