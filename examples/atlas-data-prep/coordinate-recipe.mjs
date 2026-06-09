import { pathToFileURL } from "node:url";
import {
  aggregateClusters,
  assertAtlasContractRows,
  buildDensityTiles,
} from "@catlas/atlas-react/contract";

export const DATA_PREP_WORLD_BOUNDS = {
  minX: 0,
  maxX: 1,
  minY: 0,
  maxY: 1,
};

export const SOURCE_EMBEDDING_ROWS = [
  {
    clusterId: "language-models",
    colorKey: "#2563eb",
    embedding: [0.92, 0.12, 0.42, 0.18],
    entityId: "prep-001",
    entityType: "document",
    importance: 0.94,
    label: "Alignment notes",
  },
  {
    clusterId: "language-models",
    colorKey: "#2563eb",
    embedding: [0.81, 0.18, 0.38, 0.25],
    entityId: "prep-002",
    entityType: "document",
    importance: 0.78,
    label: "Prompt tuning",
  },
  {
    clusterId: "retrieval",
    colorKey: "#059669",
    embedding: [0.22, 0.83, 0.19, 0.52],
    entityId: "prep-003",
    entityType: "document",
    importance: 0.82,
    label: "Hybrid retrieval",
  },
  {
    clusterId: "retrieval",
    colorKey: "#059669",
    embedding: [0.18, 0.88, 0.23, 0.48],
    entityId: "prep-004",
    entityType: "document",
    importance: 0.71,
    label: "Reranking evals",
  },
  {
    clusterId: "vision",
    colorKey: "#c2410c",
    embedding: [0.35, 0.24, 0.91, 0.72],
    entityId: "prep-005",
    entityType: "document",
    importance: 0.67,
    label: "Visual grounding",
  },
  {
    clusterId: "vision",
    colorKey: "#c2410c",
    embedding: [0.41, 0.28, 0.84, 0.69],
    entityId: "prep-006",
    entityType: "document",
    importance: 0.63,
    label: "Scene parsing",
  },
];

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function multiplyMatrixVector(matrix, vector) {
  return matrix.map((row) => dot(row, vector));
}

function normalizeVector(vector) {
  const magnitude = Math.hypot(...vector);
  if (magnitude === 0) {
    return vector.map((_, index) => (index === 0 ? 1 : 0));
  }
  return vector.map((value) => value / magnitude);
}

function covarianceMatrix(centeredRows) {
  const dimensions = centeredRows[0].length;
  return Array.from({ length: dimensions }, (_, rowIndex) =>
    Array.from({ length: dimensions }, (_, columnIndex) => {
      const sum = centeredRows.reduce(
        (total, row) => total + row[rowIndex] * row[columnIndex],
        0,
      );
      return sum / Math.max(1, centeredRows.length - 1);
    }),
  );
}

function powerIteration(matrix, seed) {
  let vector = normalizeVector(seed);
  for (let index = 0; index < 24; index += 1) {
    vector = normalizeVector(multiplyMatrixVector(matrix, vector));
  }
  return vector;
}

function deflate(matrix, vector) {
  const eigenvalue = dot(vector, multiplyMatrixVector(matrix, vector));
  return matrix.map((row, rowIndex) =>
    row.map(
      (value, columnIndex) =>
        value - eigenvalue * vector[rowIndex] * vector[columnIndex],
    ),
  );
}

function projectEmbeddingsWithPca(rows) {
  const dimensions = rows[0].embedding.length;
  const means = Array.from({ length: dimensions }, (_, index) =>
    rows.reduce((sum, row) => sum + row.embedding[index], 0) / rows.length,
  );
  const centeredRows = rows.map((row) =>
    row.embedding.map((value, index) => value - means[index]),
  );
  const covariance = covarianceMatrix(centeredRows);
  const pc1 = powerIteration(covariance, Array.from({ length: dimensions }, () => 1));
  const pc2 = powerIteration(
    deflate(covariance, pc1),
    Array.from({ length: dimensions }, (_, index) => (index % 2 === 0 ? 1 : -1)),
  );

  return centeredRows.map((row) => [dot(row, pc1), dot(row, pc2)]);
}

function normalizeAxis(value, min, max, outMin, outMax) {
  if (min === max) return (outMin + outMax) / 2;
  return outMin + ((value - min) / (max - min)) * (outMax - outMin);
}

function normalizeProjectedRows(rows, projectedRows, worldBounds) {
  const xs = projectedRows.map(([x]) => x);
  const ys = projectedRows.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return rows.map((row, index) => {
    const [x, y] = projectedRows[index];
    return {
      clusterId: row.clusterId,
      colorKey: row.colorKey,
      entityId: row.entityId,
      entityType: row.entityType,
      importance: row.importance,
      label: row.label,
      viewId: "atlas-data-prep",
      viewSlug: "atlas-data-prep",
      x: Number(
        normalizeAxis(x, minX, maxX, worldBounds.minX, worldBounds.maxX).toFixed(5),
      ),
      y: Number(
        normalizeAxis(y, minY, maxY, worldBounds.minY, worldBounds.maxY).toFixed(5),
      ),
    };
  });
}

export function runCoordinateRecipe(input = {}) {
  const {
    rows = SOURCE_EMBEDDING_ROWS,
    worldBounds = DATA_PREP_WORLD_BOUNDS,
  } = input ?? {};

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      clusters: [],
      densityTiles: [],
      method: "pca",
      points: [],
      sourceRows: 0,
      worldBounds,
    };
  }

  const projectedRows = projectEmbeddingsWithPca(rows);
  const points = normalizeProjectedRows(rows, projectedRows, worldBounds);
  const clusters = aggregateClusters(points, { worldBounds });
  const densityTiles = buildDensityTiles(points, {
    tileCount: 4,
    worldBounds,
    z: 2,
  });

  assertAtlasContractRows({ clusters, densityTiles, points, worldBounds });

  return {
    clusters,
    densityTiles,
    method: "pca",
    points,
    sourceRows: rows.length,
    worldBounds,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runCoordinateRecipe();
  console.log(
    `ATLAS_DATA_PREP_SUMMARY ${JSON.stringify({
      clusters: result.clusters.length,
      densityTiles: result.densityTiles.length,
      method: result.method,
      ok: true,
      points: result.points.length,
      worldBounds: result.worldBounds,
    })}`,
  );
}
