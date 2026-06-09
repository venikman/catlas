import { describe, expect, it } from "vitest";
import {
  ATLAS_DEFAULT_WORLD_BOUNDS,
  validateAtlasContractRows,
} from "@catlas/atlas-react/contract";
import { createSyntheticAtlasBatch } from "@/lib/atlas/syntheticData";

describe("synthetic atlas data", () => {
  it("creates deterministic clustered points across multiple views", () => {
    const first = createSyntheticAtlasBatch({ count: 250, seed: 42 });
    const second = createSyntheticAtlasBatch({ count: 250, seed: 42 });

    expect(first.views.length).toBeGreaterThanOrEqual(3);
    expect(first.points.length).toBe(250 * first.views.length);
    expect(first.clusters.length).toBeGreaterThan(0);
    expect(first.densityTiles.length).toBeGreaterThan(0);
    expect(first.points[0]).toEqual(second.points[0]);
    expect(new Set(first.points.map((point) => point.entityId)).size).toBe(250);
  });

  it("produces a batch that satisfies the runtime atlas contract", () => {
    const batch = createSyntheticAtlasBatch({ count: 250, seed: 42 });

    const result = validateAtlasContractRows({
      clusters: batch.clusters,
      densityTiles: batch.densityTiles,
      points: batch.points,
      worldBounds: ATLAS_DEFAULT_WORLD_BOUNDS,
    });

    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("summarizes clusters with representative entity ids", () => {
    const { clusters } = createSyntheticAtlasBatch({ count: 250, seed: 42 });

    expect(clusters.length).toBeGreaterThan(0);
    for (const cluster of clusters) {
      const repIds = (
        cluster.metadata as { representativeEntityIds?: unknown } | undefined
      )?.representativeEntityIds;
      expect(Array.isArray(repIds)).toBe(true);
      expect((repIds as string[]).length).toBeGreaterThan(0);
      expect((repIds as string[]).length).toBeLessThanOrEqual(5);
    }
  });

  it("keeps every synthetic point within the world bounds it claims", () => {
    // seed 4063122 projects one point to x≈7.106 (cluster scientific-computing).
    // Without clamping, aggregateClusters rejects it and the batch throws.
    for (const seed of [42, 170_432, 4_063_122]) {
      const batch = createSyntheticAtlasBatch({ count: 1, seed });
      for (const point of batch.points) {
        expect(point.x).toBeGreaterThanOrEqual(ATLAS_DEFAULT_WORLD_BOUNDS.minX);
        expect(point.x).toBeLessThanOrEqual(ATLAS_DEFAULT_WORLD_BOUNDS.maxX);
        expect(point.y).toBeGreaterThanOrEqual(ATLAS_DEFAULT_WORLD_BOUNDS.minY);
        expect(point.y).toBeLessThanOrEqual(ATLAS_DEFAULT_WORLD_BOUNDS.maxY);
      }
    }
  });
});
