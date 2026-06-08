import type {
  AtlasCluster,
  AtlasDensityTile,
  AtlasPoint,
  AtlasView,
} from "./types";

export type SyntheticAtlasBatch = {
  views: AtlasView[];
  points: AtlasPoint[];
  clusters: AtlasCluster[];
  densityTiles: AtlasDensityTile[];
};

export type SyntheticAtlasOptions = {
  count: number;
  seed?: number;
};

type ClusterTemplate = {
  id: string;
  label: string;
  colorKey: string;
  baseX: number;
  baseY: number;
  radius: number;
  weight: number;
  type: string;
};

export const SYNTHETIC_VIEWS: AtlasView[] = [
  {
    id: "view-research-domains",
    slug: "research-domains",
    name: "Research Domains",
    description: "Topic-space projection grouped by research domain.",
  },
  {
    id: "view-topics",
    slug: "topics",
    name: "Topics",
    description: "Finer topical projection from labels and abstracts.",
  },
  {
    id: "view-document-types",
    slug: "document-types",
    name: "Document Types",
    description: "Projection organized by publication and document type.",
  },
  {
    id: "view-languages",
    slug: "languages",
    name: "Languages",
    description: "Projection grouped by language and corpus source.",
  },
];

const CLUSTERS: ClusterTemplate[] = [
  {
    id: "graph-neural-networks",
    label: "Graph Neural Networks",
    colorKey: "#8b5cf6",
    baseX: 0.8,
    baseY: 0.2,
    radius: 1.45,
    weight: 1.25,
    type: "Research Topic",
  },
  {
    id: "computer-vision",
    label: "Computer Vision",
    colorKey: "#3b82f6",
    baseX: -1.4,
    baseY: 3.2,
    radius: 1.1,
    weight: 1.05,
    type: "Research Domain",
  },
  {
    id: "natural-language-processing",
    label: "Natural Language Processing",
    colorKey: "#65a30d",
    baseX: 2.1,
    baseY: 2.35,
    radius: 1.1,
    weight: 1.15,
    type: "Research Domain",
  },
  {
    id: "reinforcement-learning",
    label: "Reinforcement Learning",
    colorKey: "#14b8a6",
    baseX: -2.45,
    baseY: 0.0,
    radius: 1.0,
    weight: 0.8,
    type: "Research Topic",
  },
  {
    id: "knowledge-graphs",
    label: "Knowledge Graphs",
    colorKey: "#f59e0b",
    baseX: 4.3,
    baseY: -0.2,
    radius: 0.85,
    weight: 0.75,
    type: "Research Topic",
  },
  {
    id: "probabilistic-models",
    label: "Probabilistic Models",
    colorKey: "#38bdf8",
    baseX: -3.1,
    baseY: -2.35,
    radius: 1.0,
    weight: 0.85,
    type: "Research Topic",
  },
  {
    id: "bayesian-methods",
    label: "Bayesian Methods",
    colorKey: "#6366f1",
    baseX: -0.3,
    baseY: -2.45,
    radius: 0.9,
    weight: 0.8,
    type: "Research Topic",
  },
  {
    id: "generative-models",
    label: "Generative Models",
    colorKey: "#ef4444",
    baseX: 2.6,
    baseY: -1.95,
    radius: 0.9,
    weight: 0.9,
    type: "Research Topic",
  },
  {
    id: "time-series-analysis",
    label: "Time Series Analysis",
    colorKey: "#ec4899",
    baseX: 1.2,
    baseY: -3.05,
    radius: 0.85,
    weight: 0.65,
    type: "Research Topic",
  },
  {
    id: "information-retrieval",
    label: "Information Retrieval",
    colorKey: "#22c8c8",
    baseX: 4.2,
    baseY: 1.15,
    radius: 0.85,
    weight: 0.72,
    type: "Research Domain",
  },
  {
    id: "optimization",
    label: "Optimization",
    colorKey: "#fb923c",
    baseX: -1.8,
    baseY: -1.7,
    radius: 0.8,
    weight: 0.72,
    type: "Research Topic",
  },
  {
    id: "scientific-computing",
    label: "Scientific Computing",
    colorKey: "#06b6d4",
    baseX: 4.0,
    baseY: -3.0,
    radius: 0.7,
    weight: 0.55,
    type: "Research Domain",
  },
  {
    id: "robotics",
    label: "Robotics",
    colorKey: "#eab308",
    baseX: -3.6,
    baseY: 1.4,
    radius: 0.75,
    weight: 0.55,
    type: "Research Domain",
  },
];

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function normal(rng: () => number): number {
  const u = Math.max(rng(), Number.EPSILON);
  const v = Math.max(rng(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function pickCluster(rng: () => number): ClusterTemplate {
  const total = CLUSTERS.reduce((sum, cluster) => sum + cluster.weight, 0);
  let cursor = rng() * total;
  for (const cluster of CLUSTERS) {
    cursor -= cluster.weight;
    if (cursor <= 0) {
      return cluster;
    }
  }
  return CLUSTERS[0];
}

function viewPosition(
  cluster: ClusterTemplate,
  viewIndex: number,
  rng: () => number,
): { x: number; y: number } {
  const angle = viewIndex * 0.58 + rng() * 0.12;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const spreadX = normal(rng) * cluster.radius * (0.46 + viewIndex * 0.04);
  const spreadY = normal(rng) * cluster.radius * (0.32 + viewIndex * 0.035);
  const warpedX = cluster.baseX * cos - cluster.baseY * sin + viewIndex * 0.38;
  const warpedY = cluster.baseX * sin + cluster.baseY * cos - viewIndex * 0.24;
  return {
    x: Number((warpedX + spreadX).toFixed(5)),
    y: Number((warpedY + spreadY).toFixed(5)),
  };
}

function createPoint(
  entityIndex: number,
  view: AtlasView,
  viewIndex: number,
  cluster: ClusterTemplate,
  rng: () => number,
): AtlasPoint {
  const position = viewPosition(cluster, viewIndex, rng);
  const importance = Number((0.12 + rng() * 0.88).toFixed(4));
  const entityId = `ent-${String(entityIndex).padStart(7, "0")}`;
  const label = `${cluster.label} ${entityIndex + 1}`;
  return {
    id: `${view.id}-${entityId}`,
    entityId,
    viewId: view.id,
    viewSlug: view.slug,
    x: position.x,
    y: position.y,
    clusterId: cluster.id,
    label,
    entityType: rng() > 0.2 ? cluster.type : "Paper",
    importance,
    payloadSummary: `Synthetic record in ${cluster.label} for ${view.name}.`,
    metadata: {
      source: "synthetic",
      view: view.slug,
      citations: Math.floor(rng() * 900),
      updated: `202${Math.floor(rng() * 5)}-${String(1 + Math.floor(rng() * 12)).padStart(2, "0")}-15`,
    },
    colorKey: cluster.colorKey,
  };
}

export function createSyntheticEntityRows(
  entityIndex: number,
  seed = 170_431,
): AtlasPoint[] {
  const rng = createRng((seed + entityIndex * 2_654_435_761) >>> 0);
  const cluster = pickCluster(rng);
  return SYNTHETIC_VIEWS.map((view, viewIndex) =>
    createPoint(entityIndex, view, viewIndex, cluster, rng),
  );
}

function summarizeClusters(points: AtlasPoint[], views: AtlasView[]): AtlasCluster[] {
  const clusters: AtlasCluster[] = [];
  for (const view of views) {
    const pointsByCluster = new Map<string, AtlasPoint[]>();
    for (const point of points) {
      if (point.viewId !== view.id) continue;
      const existing = pointsByCluster.get(point.clusterId) ?? [];
      existing.push(point);
      pointsByCluster.set(point.clusterId, existing);
    }

    for (const [clusterId, clusterPoints] of pointsByCluster.entries()) {
      const template = CLUSTERS.find((cluster) => cluster.id === clusterId) ?? CLUSTERS[0];
      const xs = clusterPoints.map((point) => point.x);
      const ys = clusterPoints.map((point) => point.y);
      const centroidX = xs.reduce((sum, x) => sum + x, 0) / xs.length;
      const centroidY = ys.reduce((sum, y) => sum + y, 0) / ys.length;
      const boundsMinX = Math.min(...xs);
      const boundsMaxX = Math.max(...xs);
      const boundsMinY = Math.min(...ys);
      const boundsMaxY = Math.max(...ys);
      const radius = Math.max(boundsMaxX - boundsMinX, boundsMaxY - boundsMinY) / 2;
      clusters.push({
        id: `${view.id}-${clusterId}-lod-1`,
        viewId: view.id,
        viewSlug: view.slug,
        lodLevel: 1,
        clusterId,
        label: template.label,
        centroidX: Number(centroidX.toFixed(5)),
        centroidY: Number(centroidY.toFixed(5)),
        radius: Number(Math.max(radius, 0.15).toFixed(5)),
        pointCount: clusterPoints.length,
        importance: Number(
          (
            clusterPoints.reduce((sum, point) => sum + point.importance, 0) /
            clusterPoints.length
          ).toFixed(4),
        ),
        boundsMinX,
        boundsMaxX,
        boundsMinY,
        boundsMaxY,
        colorKey: template.colorKey,
        metadata: {
          representativeEntityIds: clusterPoints.slice(0, 5).map((point) => point.entityId),
        },
      });
    }
  }
  return clusters;
}

function summarizeDensityTiles(points: AtlasPoint[], views: AtlasView[]): AtlasDensityTile[] {
  const tiles = new Map<string, AtlasDensityTile>();
  const z = 2;
  const worldMin = -7;
  const worldMax = 7;
  const tileCount = 8;
  const tileSize = (worldMax - worldMin) / tileCount;

  for (const view of views) {
    for (const point of points) {
      if (point.viewId !== view.id) continue;
      const xTile = Math.max(
        0,
        Math.min(tileCount - 1, Math.floor((point.x - worldMin) / tileSize)),
      );
      const yTile = Math.max(
        0,
        Math.min(tileCount - 1, Math.floor((point.y - worldMin) / tileSize)),
      );
      const key = `${view.id}:${xTile}:${yTile}:${point.clusterId}`;
      const existing = tiles.get(key);
      if (existing) {
        existing.pointCount += 1;
        existing.densityPayload.points.push({
          x: point.x,
          y: point.y,
          weight: Number((0.35 + point.importance).toFixed(3)),
        });
      } else {
        const template = CLUSTERS.find((cluster) => cluster.id === point.clusterId) ?? CLUSTERS[0];
        tiles.set(key, {
          id: `${view.id}-tile-${z}-${xTile}-${yTile}-${point.clusterId}`,
          viewId: view.id,
          viewSlug: view.slug,
          z,
          xTile,
          yTile,
          bounds: {
            minX: worldMin + xTile * tileSize,
            maxX: worldMin + (xTile + 1) * tileSize,
            minY: worldMin + yTile * tileSize,
            maxY: worldMin + (yTile + 1) * tileSize,
          },
          densityPayload: {
            colorKey: template.colorKey,
            label: template.label,
            points: [
              {
                x: point.x,
                y: point.y,
                weight: Number((0.35 + point.importance).toFixed(3)),
              },
            ],
          },
          pointCount: 1,
        });
      }
    }
  }

  return Array.from(tiles.values()).map((tile) => ({
    ...tile,
    densityPayload: {
      ...tile.densityPayload,
      points: tile.densityPayload.points.slice(0, 40),
    },
  }));
}

export function createSyntheticAtlasBatch(
  options: SyntheticAtlasOptions,
): SyntheticAtlasBatch {
  const views = SYNTHETIC_VIEWS;
  const points: AtlasPoint[] = [];

  for (let entityIndex = 0; entityIndex < options.count; entityIndex += 1) {
    points.push(...createSyntheticEntityRows(entityIndex, options.seed ?? 170_431));
  }

  return {
    views,
    points,
    clusters: summarizeClusters(points, views),
    densityTiles: summarizeDensityTiles(points, views),
  };
}
