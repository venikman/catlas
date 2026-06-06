import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  createSyntheticEntityRows,
  SYNTHETIC_VIEWS,
} from "../lib/atlas/syntheticData";
import type { AtlasPoint } from "../lib/atlas/types";

type ClusterAgg = {
  id: string;
  viewId: string;
  viewSlug?: string;
  clusterId: string;
  label: string;
  colorKey: string;
  count: number;
  sumX: number;
  sumY: number;
  sumImportance: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  representativeEntityIds: string[];
};

type DensityAgg = {
  id: string;
  viewId: string;
  viewSlug?: string;
  z: number;
  xTile: number;
  yTile: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  colorKey: string;
  label: string;
  pointCount: number;
  points: Array<{ x: number; y: number; weight: number }>;
};

function arg(name: string, fallback?: string): string | undefined {
  const direct = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  if (direct) return direct.split("=").slice(1).join("=");
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const count = Number.parseInt(arg("count", "10000") ?? "10000", 10);
const seed = Number.parseInt(arg("seed", "170431") ?? "170431", 10);
const out = resolve(arg("out", `.atlas-data/synthetic-atlas-${count}.jsonl`) ?? "");
const batchSize = Number.parseInt(arg("batchSize", "5000") ?? "5000", 10);

if (!Number.isFinite(count) || count <= 0) {
  throw new Error("--count must be a positive integer.");
}

mkdirSync(dirname(out), { recursive: true });
const stream = createWriteStream(out, { encoding: "utf8" });
const clusters = new Map<string, ClusterAgg>();
const density = new Map<string, DensityAgg>();

function write(type: string, payload: unknown) {
  stream.write(`${JSON.stringify({ type, payload })}\n`);
}

function updateCluster(point: AtlasPoint) {
  const key = `${point.viewId}:${point.clusterId}`;
  const existing = clusters.get(key);
  if (existing) {
    existing.count += 1;
    existing.sumX += point.x;
    existing.sumY += point.y;
    existing.sumImportance += point.importance;
    existing.minX = Math.min(existing.minX, point.x);
    existing.maxX = Math.max(existing.maxX, point.x);
    existing.minY = Math.min(existing.minY, point.y);
    existing.maxY = Math.max(existing.maxY, point.y);
    if (existing.representativeEntityIds.length < 8) {
      existing.representativeEntityIds.push(point.entityId);
    }
    return;
  }

  clusters.set(key, {
    id: `${point.viewId}-${point.clusterId}-lod-1`,
    viewId: point.viewId,
    viewSlug: point.viewSlug,
    clusterId: point.clusterId,
    label: point.clusterId
      .split("-")
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(" "),
    colorKey: point.colorKey ?? "#64748b",
    count: 1,
    sumX: point.x,
    sumY: point.y,
    sumImportance: point.importance,
    minX: point.x,
    maxX: point.x,
    minY: point.y,
    maxY: point.y,
    representativeEntityIds: [point.entityId],
  });
}

function updateDensity(point: AtlasPoint) {
  const z = 2;
  const worldMin = -7;
  const tileCount = 8;
  const tileSize = 14 / tileCount;
  const xTile = Math.max(0, Math.min(tileCount - 1, Math.floor((point.x - worldMin) / tileSize)));
  const yTile = Math.max(0, Math.min(tileCount - 1, Math.floor((point.y - worldMin) / tileSize)));
  const key = `${point.viewId}:${z}:${xTile}:${yTile}:${point.clusterId}`;
  const existing = density.get(key);
  if (existing) {
    existing.pointCount += 1;
    if (existing.points.length < 40) {
      existing.points.push({
        x: point.x,
        y: point.y,
        weight: Number((0.35 + point.importance).toFixed(3)),
      });
    }
    return;
  }

  density.set(key, {
    id: `${point.viewId}-tile-${z}-${xTile}-${yTile}-${point.clusterId}`,
    viewId: point.viewId,
    viewSlug: point.viewSlug,
    z,
    xTile,
    yTile,
    bounds: {
      minX: worldMin + xTile * tileSize,
      maxX: worldMin + (xTile + 1) * tileSize,
      minY: worldMin + yTile * tileSize,
      maxY: worldMin + (yTile + 1) * tileSize,
    },
    colorKey: point.colorKey ?? "#64748b",
    label: point.clusterId,
    pointCount: 1,
    points: [
      {
        x: point.x,
        y: point.y,
        weight: Number((0.35 + point.importance).toFixed(3)),
      },
    ],
  });
}

for (const view of SYNTHETIC_VIEWS) {
  write("view", view);
}

for (let start = 0; start < count; start += batchSize) {
  const end = Math.min(count, start + batchSize);
  for (let entityIndex = start; entityIndex < end; entityIndex += 1) {
    for (const point of createSyntheticEntityRows(entityIndex, seed)) {
      updateCluster(point);
      updateDensity(point);
      write("point", point);
    }
  }
  process.stdout.write(`generated ${end.toLocaleString()} entities\r`);
}

for (const cluster of clusters.values()) {
  const radius = Math.max(cluster.maxX - cluster.minX, cluster.maxY - cluster.minY) / 2;
  write("cluster", {
    id: cluster.id,
    viewId: cluster.viewId,
    viewSlug: cluster.viewSlug,
    lodLevel: 1,
    clusterId: cluster.clusterId,
    label: cluster.label,
    centroidX: Number((cluster.sumX / cluster.count).toFixed(5)),
    centroidY: Number((cluster.sumY / cluster.count).toFixed(5)),
    radius: Number(Math.max(radius, 0.15).toFixed(5)),
    pointCount: cluster.count,
    importance: Number((cluster.sumImportance / cluster.count).toFixed(4)),
    boundsMinX: cluster.minX,
    boundsMaxX: cluster.maxX,
    boundsMinY: cluster.minY,
    boundsMaxY: cluster.maxY,
    colorKey: cluster.colorKey,
    metadata: { representativeEntityIds: cluster.representativeEntityIds },
  });
}

for (const tile of density.values()) {
  write("density_tile", {
    id: tile.id,
    viewId: tile.viewId,
    viewSlug: tile.viewSlug,
    z: tile.z,
    xTile: tile.xTile,
    yTile: tile.yTile,
    bounds: tile.bounds,
    densityPayload: {
      points: tile.points,
      colorKey: tile.colorKey,
      label: tile.label,
    },
    pointCount: tile.pointCount,
  });
}

stream.end(() => {
  process.stdout.write("\n");
  console.log(`Wrote ${out}`);
  console.log(
    `Entities: ${count.toLocaleString()} · point rows: ${(count * SYNTHETIC_VIEWS.length).toLocaleString()} · clusters: ${clusters.size} · density tiles: ${density.size}`,
  );
});
