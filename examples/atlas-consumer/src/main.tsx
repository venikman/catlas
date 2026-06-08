import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  SemanticAtlasMap,
  type AtlasCluster,
  type AtlasDensityTile,
  type AtlasPoint,
  type AtlasViewportState,
} from "@catlas/atlas-react";
import "./style.css";

const colors = ["#2b6cb0", "#2f855a", "#b7791f", "#805ad5", "#c05621"];

const clusterSeeds = [
  { id: "language", label: "Language Models", x: -1.85, y: -0.9, radius: 1.1 },
  { id: "retrieval", label: "Retrieval", x: 0.2, y: -0.2, radius: 1.0 },
  { id: "vision", label: "Vision", x: 1.95, y: 0.72, radius: 1.25 },
  { id: "biology", label: "Biology", x: -0.45, y: 1.3, radius: 1.15 },
  { id: "systems", label: "Systems", x: 2.75, y: -1.2, radius: 0.9 },
];

function seededWave(seed: number): number {
  return Math.sin(seed * 12.9898) * Math.cos(seed * 78.233);
}

function buildClusters(): AtlasCluster[] {
  return clusterSeeds.map((seed, index) => ({
    boundsMaxX: seed.x + seed.radius,
    boundsMaxY: seed.y + seed.radius * 0.72,
    boundsMinX: seed.x - seed.radius,
    boundsMinY: seed.y - seed.radius * 0.72,
    centroidX: seed.x,
    centroidY: seed.y,
    clusterId: seed.id,
    colorKey: colors[index % colors.length] ?? "#2b6cb0",
    id: `fixture-cluster-${seed.id}`,
    importance: 0.68 + index * 0.05,
    label: seed.label,
    lodLevel: 1,
    pointCount: 1800 + index * 620,
    radius: seed.radius,
    viewId: "fixture-view",
    viewSlug: "fixture",
  }));
}

function buildPoints(clusters: AtlasCluster[]): AtlasPoint[] {
  return clusters.flatMap((cluster, clusterIndex) =>
    Array.from({ length: 130 }, (_, index) => {
      const angle = index * 0.55 + clusterIndex;
      const ring = 0.1 + ((index % 23) / 23) * cluster.radius * 0.86;
      const wobble = seededWave(index + clusterIndex * 47) * 0.12;
      return {
        clusterId: cluster.clusterId,
        colorKey: cluster.colorKey,
        entityId: `fixture-${cluster.clusterId}-${index}`,
        entityType: "document",
        id: `fixture-point-${cluster.clusterId}-${index}`,
        importance: Math.max(0.08, 1 - index / 170),
        label: `${cluster.label} ${index + 1}`,
        viewId: "fixture-view",
        viewSlug: "fixture",
        x: cluster.centroidX + Math.cos(angle) * (ring + wobble),
        y: cluster.centroidY + Math.sin(angle) * (ring * 0.68 + wobble * 0.35),
      };
    }),
  );
}

function buildDensityTiles(clusters: AtlasCluster[]): AtlasDensityTile[] {
  return clusters.map((cluster, clusterIndex) => ({
    bounds: {
      maxX: cluster.boundsMaxX + 0.36,
      maxY: cluster.boundsMaxY + 0.28,
      minX: cluster.boundsMinX - 0.36,
      minY: cluster.boundsMinY - 0.28,
    },
    densityPayload: {
      colorKey: cluster.colorKey,
      label: cluster.label,
      points: Array.from({ length: 92 }, (_, index) => {
        const angle = index * 0.72 + clusterIndex;
        const radius = cluster.radius * (0.16 + (index % 31) / 36);
        return {
          weight: 0.45 + ((index + clusterIndex) % 11) / 12,
          x: cluster.centroidX + Math.cos(angle) * radius,
          y: cluster.centroidY + Math.sin(angle) * radius * 0.64,
        };
      }),
    },
    id: `fixture-density-${cluster.clusterId}`,
    pointCount: cluster.pointCount,
    viewId: "fixture-view",
    viewSlug: "fixture",
    xTile: clusterIndex,
    yTile: 0,
    z: 3,
  }));
}

function ConsumerFixture() {
  const clusters = useMemo(() => buildClusters(), []);
  const points = useMemo(() => buildPoints(clusters), [clusters]);
  const densityTiles = useMemo(() => buildDensityTiles(clusters), [clusters]);
  const [viewport, setViewport] = useState<AtlasViewportState>({
    centerX: 0.35,
    centerY: 0,
    zoom: 6.9,
  });

  return (
    <main className="fixture-shell" data-testid="consumer-root">
      <SemanticAtlasMap
        clusters={clusters}
        densityTiles={densityTiles}
        layers={{ labels: true, links: true, points: true }}
        lod="points"
        onViewportChange={setViewport}
        points={points}
        viewport={viewport}
      />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConsumerFixture />
  </React.StrictMode>,
);
