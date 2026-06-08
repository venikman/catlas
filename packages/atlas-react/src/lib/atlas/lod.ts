import type { AtlasLodLayer } from "./types";

export const ATLAS_LOD_CONFIG = {
  densityMaxZoom: 3,
  clusterMaxZoom: 6,
  pointsMinZoom: 6.01,
  maxDensityTiles: 240,
  maxClusters: 600,
  maxRepresentativePoints: 760,
  maxPoints: 5000,
  maxSearchResults: 20,
  viewTransitionMs: 720,
} as const;

export type AtlasLodDecision = {
  layer: AtlasLodLayer;
  endpoint: "/api/atlas/density" | "/api/atlas/clusters" | "/api/atlas/points";
  maxItems: number;
  labels: boolean;
  hover: boolean;
};

export function getLodForZoom(zoom: number): AtlasLodDecision {
  if (zoom < ATLAS_LOD_CONFIG.densityMaxZoom) {
    return {
      layer: "density",
      endpoint: "/api/atlas/density",
      maxItems: ATLAS_LOD_CONFIG.maxDensityTiles,
      labels: false,
      hover: false,
    };
  }

  if (zoom < ATLAS_LOD_CONFIG.pointsMinZoom) {
    return {
      layer: "clusters",
      endpoint: "/api/atlas/clusters",
      maxItems: ATLAS_LOD_CONFIG.maxClusters,
      labels: true,
      hover: true,
    };
  }

  return {
    layer: "points",
    endpoint: "/api/atlas/points",
    maxItems: ATLAS_LOD_CONFIG.maxPoints,
    labels: true,
    hover: true,
  };
}

export function zoomBandForZoom(zoom: number): string {
  const lod = getLodForZoom(zoom).layer;
  if (lod === "density") {
    return "0-3";
  }
  if (lod === "clusters") {
    return "3-6";
  }
  return "6+";
}

export function shouldFetchPoints(zoom: number): boolean {
  return getLodForZoom(zoom).layer === "points";
}
