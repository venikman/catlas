import { describe, expect, it } from "vitest";
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
});
