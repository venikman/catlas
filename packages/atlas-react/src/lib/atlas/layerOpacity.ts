import { ATLAS_LOD_CONFIG } from "./lod";
import { clamp } from "./math";

export type AtlasLayerOpacities = {
  branchLabels: number;
  branches: number;
  clusterLabels: number;
  clusters: number;
  contours: number;
  density: number;
  pointLabels: number;
  points: number;
  regionLabels: number;
};

function smoothstep(edge0: number, edge1: number, value: number): number {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function roundOpacity(value: number): number {
  return Number(clamp(value, 0, 1).toFixed(3));
}

export function getAtlasLayerOpacities(zoom: number): AtlasLayerOpacities {
  const densityToClusters = smoothstep(
    ATLAS_LOD_CONFIG.densityMaxZoom - 0.5,
    ATLAS_LOD_CONFIG.densityMaxZoom + 0.5,
    zoom,
  );
  const clustersToPoints = smoothstep(
    ATLAS_LOD_CONFIG.pointsMinZoom - 0.55,
    ATLAS_LOD_CONFIG.pointsMinZoom + 0.65,
    zoom,
  );
  const branchEntrance = smoothstep(2.75, 4.15, zoom);
  const branchExit = smoothstep(5.85, 6.75, zoom);
  const densityBase = 1 - densityToClusters;
  const clusters = densityToClusters * (1 - clustersToPoints);
  const points = clustersToPoints;
  const branches = branchEntrance * (1 - branchExit) * 0.26;
  const retainedDensity = Math.max(densityBase, clusters * 0.32, points * 0.3);
  const retainedRegionLabels = Math.max(densityBase, clusters * 0.42, points * 0.28);
  const retainedClusters = Math.max(clusters, points * 0.12);
  const retainedClusterLabels = Math.max(clusters, points * 0.04);

  return {
    branchLabels: roundOpacity(branches * clusters * 0.35),
    branches: roundOpacity(branches),
    clusterLabels: roundOpacity(retainedClusterLabels),
    clusters: roundOpacity(retainedClusters),
    contours: roundOpacity(Math.max(densityBase * 0.24, clusters * 0.2, points * 0.14, branches * 0.12)),
    density: roundOpacity(retainedDensity),
    pointLabels: roundOpacity(points),
    points: roundOpacity(points),
    regionLabels: roundOpacity(retainedRegionLabels),
  };
}
