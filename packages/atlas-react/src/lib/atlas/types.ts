export type AtlasLodLayer = "density" | "clusters" | "points";

export type AtlasView = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AtlasBbox = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type AtlasPoint = {
  id?: string;
  entityId: string;
  viewId?: string;
  viewSlug?: string;
  x: number;
  y: number;
  clusterId: string;
  label: string;
  entityType: string;
  importance: number;
  payloadSummary?: string;
  metadata?: Record<string, unknown>;
  colorKey?: string;
};

export type AtlasCluster = {
  id: string;
  viewId: string;
  viewSlug?: string;
  lodLevel: number;
  clusterId: string;
  label: string;
  centroidX: number;
  centroidY: number;
  radius: number;
  pointCount: number;
  importance: number;
  boundsMinX: number;
  boundsMaxX: number;
  boundsMinY: number;
  boundsMaxY: number;
  colorKey: string;
  metadata?: Record<string, unknown>;
};

export type AtlasDensityTile = {
  id: string;
  viewId: string;
  viewSlug?: string;
  z: number;
  xTile: number;
  yTile: number;
  bounds: AtlasBbox;
  densityPayload: {
    points: Array<{ x: number; y: number; weight: number }>;
    colorKey: string;
    label?: string;
  };
  pointCount: number;
  createdAt?: string;
};

export type AtlasEntityDetails = {
  entityId: string;
  label: string;
  entityType: string;
  payloadSummary: string;
  metadata: Record<string, unknown>;
  views: Array<{
    viewId: string;
    viewSlug?: string;
    x: number;
    y: number;
    clusterId: string;
  }>;
};

export type AtlasSearchResult = {
  entityId: string;
  label: string;
  entityType: string;
  x: number;
  y: number;
  clusterId: string;
  score: number;
};

export type ParsedAtlasViewport = {
  view: string;
  zoom: number;
  bbox: AtlasBbox & {
    width: number;
    height: number;
  };
  limit: number;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string };
