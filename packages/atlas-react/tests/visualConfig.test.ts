import { describe, expect, it } from "vitest";
import { ATLAS_LOD_CONFIG } from "@/lib/atlas/lod";
import type { AtlasCluster } from "@/lib/atlas/types";
import {
  ATLAS_VISUAL_CONFIG,
  atlasZoomToDisplayZoom,
  clampAtlasZoom,
  displayZoomToAtlasZoom,
  getLodBlend,
  getPointVisualStyle,
  selectClusterLabels,
} from "@/lib/atlas/visualConfig";

function cluster(input: Partial<AtlasCluster> & { id: string }): AtlasCluster {
  return {
    id: input.id,
    viewId: "view",
    viewSlug: "research-domains",
    lodLevel: 3,
    clusterId: input.clusterId ?? input.id,
    label: input.label ?? input.id,
    centroidX: input.centroidX ?? 0,
    centroidY: input.centroidY ?? 0,
    radius: input.radius ?? 1,
    pointCount: input.pointCount ?? 100,
    importance: input.importance ?? 0.5,
    boundsMinX: input.boundsMinX ?? -1,
    boundsMaxX: input.boundsMaxX ?? 1,
    boundsMinY: input.boundsMinY ?? -1,
    boundsMaxY: input.boundsMaxY ?? 1,
    colorKey: input.colorKey ?? "#2563eb",
    metadata: input.metadata,
  };
}

describe("atlas visual config", () => {
  it("tracks the LOD zoom thresholds and clamps interaction zoom", () => {
    expect(ATLAS_VISUAL_CONFIG.zoom.densityMax).toBe(
      ATLAS_LOD_CONFIG.densityMaxZoom,
    );
    expect(ATLAS_VISUAL_CONFIG.zoom.pointsMin).toBe(
      ATLAS_LOD_CONFIG.pointsMinZoom,
    );
    expect(clampAtlasZoom(99)).toBe(ATLAS_VISUAL_CONFIG.zoom.max);
    expect(clampAtlasZoom(-99)).toBe(ATLAS_VISUAL_CONFIG.zoom.min);
    expect(ATLAS_VISUAL_CONFIG.zoom.max).toBeGreaterThan(
      ATLAS_VISUAL_CONFIG.zoom.flyToZoom,
    );
    expect(ATLAS_VISUAL_CONFIG.zoom.max).toBeLessThanOrEqual(
      ATLAS_VISUAL_CONFIG.zoom.flyToZoom + 0.45,
    );
  });

  it("keeps the visible zoom ticks separate from internal camera zoom", () => {
    expect(atlasZoomToDisplayZoom(ATLAS_VISUAL_CONFIG.zoom.min)).toBe(
      ATLAS_VISUAL_CONFIG.zoom.displayMin,
    );
    expect(atlasZoomToDisplayZoom(ATLAS_VISUAL_CONFIG.zoom.max)).toBe(
      ATLAS_VISUAL_CONFIG.zoom.displayMax,
    );
    expect(displayZoomToAtlasZoom(ATLAS_VISUAL_CONFIG.zoom.displayMin)).toBe(
      ATLAS_VISUAL_CONFIG.zoom.min,
    );
    expect(displayZoomToAtlasZoom(ATLAS_VISUAL_CONFIG.zoom.displayMax)).toBe(
      ATLAS_VISUAL_CONFIG.zoom.max,
    );
  });

  it("crossfades density, clusters, and points around configured thresholds", () => {
    const densityToClusters = getLodBlend(2.9);
    expect(densityToClusters.density).toBeGreaterThan(0);
    expect(densityToClusters.clusters).toBeGreaterThan(0);
    expect(densityToClusters.points).toBe(0);

    const medium = getLodBlend(4.2);
    expect(medium.clusters).toBeGreaterThan(0.95);
    expect(medium.density).toBe(0);
    expect(medium.points).toBe(0);

    const clustersToPoints = getLodBlend(6.08);
    expect(clustersToPoints.clusters).toBeGreaterThan(0);
    expect(clustersToPoints.points).toBeGreaterThan(0);
    expect(clustersToPoints.density).toBe(0);

    const high = getLodBlend(7.2);
    expect(high.points).toBe(1);
    expect(high.clusters).toBe(0);
  });

  it("makes high-zoom, hover, and selected points visually stronger", () => {
    const clusterPoint = getPointVisualStyle({
      hovered: false,
      importance: 0.62,
      lod: "clusters",
      pixelWorld: 0.01,
      selected: false,
      transitionOpacity: 1,
    });
    const highPoint = getPointVisualStyle({
      hovered: false,
      importance: 0.62,
      lod: "points",
      pixelWorld: 0.01,
      selected: false,
      transitionOpacity: 1,
    });
    const hoveredPoint = getPointVisualStyle({
      hovered: true,
      importance: 0.62,
      lod: "points",
      pixelWorld: 0.01,
      selected: false,
      transitionOpacity: 1,
    });
    const selectedPoint = getPointVisualStyle({
      hovered: true,
      importance: 0.62,
      lod: "points",
      pixelWorld: 0.01,
      selected: true,
      transitionOpacity: 1,
    });

    expect(highPoint.radius).toBeGreaterThan(clusterPoint.radius);
    expect(hoveredPoint.radius).toBeGreaterThan(highPoint.radius);
    expect(selectedPoint.radius).toBeGreaterThan(hoveredPoint.radius);
    expect(selectedPoint.strokeWidth).toBeGreaterThan(0);
    expect(selectedPoint.strokeColor).toContain("rgba");
  });

  it("prioritizes important cluster labels and suppresses overlapping labels", () => {
    const labels = selectClusterLabels({
      clusters: [
        cluster({
          id: "large-center",
          centroidX: 0,
          centroidY: 0,
          importance: 0.95,
          pointCount: 3000,
        }),
        cluster({
          id: "near-small",
          centroidX: 0.03,
          centroidY: 0.02,
          importance: 0.4,
          pointCount: 100,
        }),
        cluster({
          id: "far-important",
          centroidX: 1.8,
          centroidY: 1.2,
          importance: 0.82,
          pointCount: 900,
        }),
      ],
      lod: "clusters",
      spanX: 6,
      spanY: 4,
    });

    expect(labels.map((item) => item.id)).toContain("large-center");
    expect(labels.map((item) => item.id)).toContain("far-important");
    expect(labels.map((item) => item.id)).not.toContain("near-small");
    expect(labels.length).toBeLessThanOrEqual(
      ATLAS_VISUAL_CONFIG.labels.clusters.maxCount,
    );
  });
});
