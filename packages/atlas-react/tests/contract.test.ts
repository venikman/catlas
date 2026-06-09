import { describe, expect, it } from "vitest";
import {
  ATLAS_CONTRACT_GOLDEN_FIXTURES,
  ATLAS_UNIT_WORLD_BOUNDS,
  aggregateClusters,
  assertAtlasContractRows,
  buildDensityTiles,
  validateAtlasContractRows,
  type AtlasPoint,
} from "../src/contract";

describe("atlas contract runtime", () => {
  it("validates the golden fixtures", () => {
    for (const fixture of Object.values(ATLAS_CONTRACT_GOLDEN_FIXTURES)) {
      const result = validateAtlasContractRows(fixture);

      expect(result.issues).toEqual([]);
      expect(result.ok).toBe(true);
    }
  });

  it("reports precise field paths for invalid rows", () => {
    const result = validateAtlasContractRows({
      points: [
        {
          clusterId: "bad",
          entityId: "bad-1",
          entityType: "document",
          importance: 0.5,
          label: "Bad row",
          x: 9,
          y: 0,
        } as AtlasPoint,
      ],
      worldBounds: ATLAS_UNIT_WORLD_BOUNDS,
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual({
      path: "points[0].x",
      message: "must be within [0, 1]",
    });
  });

  it("aggregates clusters from parameterized world coordinates", () => {
    const points: AtlasPoint[] = [
      {
        clusterId: "left",
        colorKey: "#2563eb",
        entityId: "left-1",
        entityType: "document",
        importance: 0.6,
        label: "Left 1",
        viewId: "fixture",
        viewSlug: "fixture",
        x: 0.1,
        y: 0.2,
      },
      {
        clusterId: "left",
        colorKey: "#2563eb",
        entityId: "left-2",
        entityType: "document",
        importance: 0.8,
        label: "Left 2",
        viewId: "fixture",
        viewSlug: "fixture",
        x: 0.3,
        y: 0.4,
      },
    ];

    const clusters = aggregateClusters(points, {
      lodLevel: 2,
      worldBounds: ATLAS_UNIT_WORLD_BOUNDS,
    });

    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toMatchObject({
      centroidX: 0.2,
      centroidY: 0.3,
      lodLevel: 2,
      pointCount: 2,
      viewSlug: "fixture",
    });
  });

  it("builds density tiles with explicit worldBounds, tileCount, and z", () => {
    const [firstPoint] = ATLAS_CONTRACT_GOLDEN_FIXTURES.unitWorld.points;
    const tiles = buildDensityTiles([firstPoint], {
      tileCount: 5,
      worldBounds: ATLAS_UNIT_WORLD_BOUNDS,
      z: 4,
    });

    expect(tiles).toHaveLength(1);
    expect(tiles[0].z).toBe(4);
    expect(tiles[0].xTile).toBe(0);
    expect(tiles[0].yTile).toBe(3);
    assertAtlasContractRows({
      densityTiles: tiles,
      points: [firstPoint],
      worldBounds: ATLAS_UNIT_WORLD_BOUNDS,
    });
  });
});
