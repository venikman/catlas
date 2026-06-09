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

  it("does not crash on nullish contract inputs", () => {
    expect(validateAtlasContractRows(null).issues).toContainEqual({
      path: "rows",
      message: "must be an object",
    });
    expect(validateAtlasContractRows({ points: [] }, null).ok).toBe(true);
    expect(aggregateClusters(null as unknown as AtlasPoint[])).toEqual([]);
    expect(buildDensityTiles(null as unknown as AtlasPoint[])).toEqual([]);
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
      metadataForCluster: (_clusterId, clusterPoints) => ({
        representativeEntityIds: clusterPoints.map((point) => point.entityId),
      }),
      worldBounds: ATLAS_UNIT_WORLD_BOUNDS,
    });

    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toMatchObject({
      centroidX: 0.2,
      centroidY: 0.3,
      lodLevel: 2,
      metadata: {
        representativeEntityIds: ["left-1", "left-2"],
      },
      pointCount: 2,
      radius: 0.15,
      viewSlug: "fixture",
    });
  });

  it("keeps raw atlas ids collision-free when ids contain delimiters", () => {
    const points: AtlasPoint[] = [
      {
        clusterId: "c",
        colorKey: "#2563eb",
        entityId: "first",
        entityType: "document",
        importance: 0.6,
        label: "First",
        viewId: "a:b",
        x: 0.1,
        y: 0.2,
      },
      {
        clusterId: "b:c",
        colorKey: "#059669",
        entityId: "second",
        entityType: "document",
        importance: 0.8,
        label: "Second",
        viewId: "a",
        x: 0.3,
        y: 0.4,
      },
    ];

    const clusters = aggregateClusters(points, {
      worldBounds: ATLAS_UNIT_WORLD_BOUNDS,
    });

    expect(clusters).toHaveLength(2);
    expect(clusters.map((cluster) => cluster.pointCount)).toEqual([1, 1]);
  });

  it("generates collision-free cluster ids when source ids contain separators", () => {
    const points: AtlasPoint[] = [
      {
        clusterId: "c",
        colorKey: "#2563eb",
        entityId: "first",
        entityType: "document",
        importance: 0.6,
        label: "First",
        viewId: "a-b",
        x: 0.1,
        y: 0.2,
      },
      {
        clusterId: "b-c",
        colorKey: "#059669",
        entityId: "second",
        entityType: "document",
        importance: 0.8,
        label: "Second",
        viewId: "a",
        x: 0.3,
        y: 0.4,
      },
    ];

    const clusters = aggregateClusters(points, {
      worldBounds: ATLAS_UNIT_WORLD_BOUNDS,
    });

    expect(clusters).toHaveLength(2);
    expect(new Set(clusters.map((cluster) => cluster.id)).size).toBe(2);
  });

  it("rejects aggregate points outside the configured worldBounds", () => {
    expect(() =>
      aggregateClusters(
        [
          {
            clusterId: "outside",
            colorKey: "#2563eb",
            entityId: "outside-1",
            entityType: "document",
            importance: 0.6,
            label: "Outside",
            viewId: "fixture",
            x: 2,
            y: 0.5,
          },
        ],
        { worldBounds: ATLAS_UNIT_WORLD_BOUNDS },
      ),
    ).toThrow("outside worldBounds");
  });

  it("aggregates large clusters without spreading coordinates into Math.min/max", () => {
    const points: AtlasPoint[] = Array.from({ length: 70_000 }, (_, index) => ({
      clusterId: "large",
      colorKey: "#2563eb",
      entityId: `large-${index}`,
      entityType: "document",
      importance: 0.5,
      label: `Large ${index}`,
      viewId: "large-view",
      x: index / 70_000,
      y: 1 - index / 70_000,
    }));

    const clusters = aggregateClusters(points, {
      worldBounds: ATLAS_UNIT_WORLD_BOUNDS,
    });

    expect(clusters).toHaveLength(1);
    expect(clusters[0].pointCount).toBe(70_000);
    expect(clusters[0].boundsMinX).toBe(0);
    expect(clusters[0].boundsMaxY).toBe(1);
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
