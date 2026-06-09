import type { AtlasPoint } from "../lib/atlas/types";
import { aggregateClusters, buildDensityTiles } from "./atlasAggregation";
import {
  ATLAS_DEFAULT_WORLD_BOUNDS,
  type AtlasWorldBounds,
} from "./atlasStore";
import type { AtlasContractRows } from "./atlasValidation";

export type AtlasContractFixture = AtlasContractRows & {
  name: string;
  worldBounds: AtlasWorldBounds;
  points: AtlasPoint[];
};

export const ATLAS_GOLDEN_POINTS: AtlasPoint[] = [
  {
    clusterId: "language-models",
    colorKey: "#2563eb",
    entityId: "golden-001",
    entityType: "document",
    importance: 0.92,
    label: "Language model alignment",
    viewId: "golden-view",
    viewSlug: "golden",
    x: -3.2,
    y: 1.6,
  },
  {
    clusterId: "language-models",
    colorKey: "#2563eb",
    entityId: "golden-002",
    entityType: "document",
    importance: 0.75,
    label: "Instruction tuning",
    viewId: "golden-view",
    viewSlug: "golden",
    x: -2.6,
    y: 1.2,
  },
  {
    clusterId: "retrieval",
    colorKey: "#059669",
    entityId: "golden-003",
    entityType: "document",
    importance: 0.81,
    label: "Hybrid retrieval",
    viewId: "golden-view",
    viewSlug: "golden",
    x: 2.35,
    y: -1.8,
  },
  {
    clusterId: "retrieval",
    colorKey: "#059669",
    entityId: "golden-004",
    entityType: "document",
    importance: 0.64,
    label: "Reranking pipelines",
    viewId: "golden-view",
    viewSlug: "golden",
    x: 2.95,
    y: -1.35,
  },
];

export const ATLAS_UNIT_GOLDEN_POINTS: AtlasPoint[] = [
  {
    clusterId: "northwest",
    colorKey: "#7c3aed",
    entityId: "unit-001",
    entityType: "document",
    importance: 0.73,
    label: "Unit northwest",
    viewId: "unit-view",
    viewSlug: "unit",
    x: 0.18,
    y: 0.78,
  },
  {
    clusterId: "southeast",
    colorKey: "#ea580c",
    entityId: "unit-002",
    entityType: "document",
    importance: 0.69,
    label: "Unit southeast",
    viewId: "unit-view",
    viewSlug: "unit",
    x: 0.82,
    y: 0.24,
  },
];

export const ATLAS_UNIT_WORLD_BOUNDS: AtlasWorldBounds = {
  minX: 0,
  maxX: 1,
  minY: 0,
  maxY: 1,
};

function fixtureFromPoints(
  name: string,
  worldBounds: AtlasWorldBounds,
  points: AtlasPoint[],
): AtlasContractFixture {
  return {
    clusters: aggregateClusters(points, { worldBounds }),
    densityTiles: buildDensityTiles(points, { tileCount: 4, worldBounds, z: 2 }),
    name,
    points,
    worldBounds,
  };
}

export const ATLAS_CONTRACT_GOLDEN_FIXTURES = {
  defaultWorld: fixtureFromPoints(
    "default-world",
    ATLAS_DEFAULT_WORLD_BOUNDS,
    ATLAS_GOLDEN_POINTS,
  ),
  unitWorld: fixtureFromPoints(
    "unit-world",
    ATLAS_UNIT_WORLD_BOUNDS,
    ATLAS_UNIT_GOLDEN_POINTS,
  ),
} satisfies Record<string, AtlasContractFixture>;
