import { ATLAS_LOD_CONFIG } from "./lod";
import { clamp } from "./math";
import type { AtlasCluster, AtlasLodLayer } from "./types";

export const ATLAS_VISUAL_CONFIG = {
  zoom: {
    min: -1.5,
    max: 7.4,
    displayMin: -10,
    displayMax: 10,
    densityMax: ATLAS_LOD_CONFIG.densityMaxZoom,
    pointsMin: ATLAS_LOD_CONFIG.pointsMinZoom,
    wheelSensitivity: 0.004,
    clusterClickZoom: 5.35,
    flyToZoom: 7.15,
    fetchPadding: 1.18,
    debounceMs: 140,
  },
  animation: {
    lodCrossfadeWindow: 0.42,
    viewSwitchMs: ATLAS_LOD_CONFIG.viewTransitionMs,
    targetMarkerMs: 1100,
  },
  density: {
    coreMinPx: 14,
    coreMaxPx: 40,
    haloScale: 2.8,
    coreAlphaMin: 0.00035,
    coreAlphaMax: 0.0012,
    haloAlphaMin: 0.0001,
    haloAlphaMax: 0.00055,
  },
  regions: {
    maxCount: 9,
    minRadiusPx: 72,
    maxRadiusPx: 210,
    spreadScale: 1.72,
    fillAlpha: 0.00045,
    strokeAlpha: 0.012,
    outerStrokeAlpha: 0.005,
  },
  contours: {
    ringCount: 3,
    baseRadiusScale: 0.58,
    ringSpacing: 0.27,
    minRadius: 0.42,
    maxRadius: 1.58,
    alphaByRing: [0.028, 0.018, 0.01],
    widthByRing: [0.62, 0.46, 0.32],
  },
  branches: {
    maxCount: 90,
    maxPerCluster: 7,
    minImportance: 0.28,
    curveScale: 0.11,
    alpha: 0.13,
    widthPx: 0.55,
  },
  clusters: {
    bubbleMinPx: 5,
    bubbleMaxPx: 17,
    radiusScale: 0.055,
    fillAlpha: 0.012,
    strokeAlpha: 0.045,
    hoverFillAlpha: 0.048,
    hoverStrokeAlpha: 0.22,
    haloAlpha: 0.014,
    centerAlpha: 0.32,
    representativeOpacity: 0.28,
  },
  points: {
    clusterRadiusMinPx: 0.45,
    clusterRadiusMaxPx: 1.18,
    highRadiusMinPx: 0.78,
    highRadiusMaxPx: 1.85,
    densityRadiusMinPx: 0.36,
    densityRadiusMaxPx: 0.88,
    clusterOpacity: 0.64,
    densityOpacity: 0.28,
    highOpacity: 0.84,
    hoverScale: 2.2,
    selectedScale: 2.65,
    selectedStrokePx: 1.5,
    hoverStrokePx: 1,
  },
  labels: {
    density: {
      maxCount: 9,
      collisionPx: 148,
      edgePaddingRatio: 0.08,
      minWeight: 0.18,
      fontMinPx: 11,
      fontMaxPx: 13.5,
    },
    clusters: {
      maxCount: 18,
      collisionPx: 82,
      edgePaddingRatio: 0.045,
      fontMinPx: 12,
      fontMaxPx: 15.5,
    },
    points: {
      maxCount: 4,
      collisionPx: 150,
      edgePaddingRatio: 0.08,
      fontMinPx: 11,
      fontMaxPx: 14,
    },
  },
  palette: {
    paper: "#f4f4f1",
    ink: "#0f172a",
    mutedInk: "#475569",
    labelHalo: "rgba(44, 53, 58, 0.7)",
    selectedStroke: "#0f172a",
    hoverStroke: "#334155",
    fallback: "#64748b",
  },
} as const;

export type LodBlend = {
  clusters: number;
  density: number;
  points: number;
};

export type PointVisualInput = {
  colorKey?: string;
  hovered: boolean;
  importance: number;
  lod: AtlasLodLayer;
  pixelWorld: number;
  selected: boolean;
  transitionOpacity?: number;
};

export type PointVisualStyle = {
  fillColor: string;
  haloOpacity: number;
  haloRadius: number;
  opacity: number;
  radius: number;
  strokeColor: string;
  strokeWidth: number;
};

export type DensitySampleLike = {
  colorKey?: string;
  id: string;
  label?: string;
  weight: number;
  x: number;
  y: number;
};

export type DensityVisualStyle = {
  coreColor: string;
  coreRadius: number;
  haloColor: string;
  haloRadius: number;
};

export type DensityLabel = {
  colorKey?: string;
  id: string;
  label: string;
  score: number;
  x: number;
  y: number;
};

export function clampAtlasZoom(zoom: number): number {
  return Number(
    clamp(zoom, ATLAS_VISUAL_CONFIG.zoom.min, ATLAS_VISUAL_CONFIG.zoom.max).toFixed(2),
  );
}

export function atlasZoomToDisplayZoom(zoom: number): number {
  const config = ATLAS_VISUAL_CONFIG.zoom;
  const normalized =
    (clampAtlasZoom(zoom) - config.min) / (config.max - config.min);
  return Number(
    (
      config.displayMin +
      normalized * (config.displayMax - config.displayMin)
    ).toFixed(2),
  );
}

export function displayZoomToAtlasZoom(displayZoom: number): number {
  const config = ATLAS_VISUAL_CONFIG.zoom;
  const normalized =
    (clamp(displayZoom, config.displayMin, config.displayMax) -
      config.displayMin) /
    (config.displayMax - config.displayMin);
  return clampAtlasZoom(config.min + normalized * (config.max - config.min));
}

export function rgbaCssFromHex(hex: string | undefined, alpha: number): string {
  const normalized = (hex ?? ATLAS_VISUAL_CONFIG.palette.fallback).replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized.padEnd(6, "0").slice(0, 6);

  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${clamp(alpha, 0, 1).toFixed(3)})`;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

export function getLodBlend(zoom: number): LodBlend {
  const window = ATLAS_VISUAL_CONFIG.animation.lodCrossfadeWindow;
  const densityToClusters = smoothstep(
    ATLAS_VISUAL_CONFIG.zoom.densityMax - window,
    ATLAS_VISUAL_CONFIG.zoom.densityMax + window,
    zoom,
  );
  const clustersToPoints = smoothstep(
    ATLAS_VISUAL_CONFIG.zoom.pointsMin - window,
    ATLAS_VISUAL_CONFIG.zoom.pointsMin + window,
    zoom,
  );

  return {
    density: Number((1 - densityToClusters).toFixed(3)),
    clusters: Number((densityToClusters * (1 - clustersToPoints)).toFixed(3)),
    points: Number(clustersToPoints.toFixed(3)),
  };
}

export function getPointVisualStyle(input: PointVisualInput): PointVisualStyle {
  const importance = clamp(input.importance, 0, 1);
  const config = ATLAS_VISUAL_CONFIG.points;
  const basePx =
    input.lod === "points"
      ? config.highRadiusMinPx +
        Math.pow(importance, 0.72) * (config.highRadiusMaxPx - config.highRadiusMinPx)
      : input.lod === "clusters"
        ? config.clusterRadiusMinPx +
          Math.pow(importance, 0.8) *
            (config.clusterRadiusMaxPx - config.clusterRadiusMinPx)
        : config.densityRadiusMinPx +
          Math.pow(importance, 0.8) *
            (config.densityRadiusMaxPx - config.densityRadiusMinPx);
  const stateScale = input.selected
    ? config.selectedScale
    : input.hovered
      ? config.hoverScale
      : 1;
  const baseOpacity =
    input.lod === "points"
      ? config.highOpacity
      : input.lod === "clusters"
        ? config.clusterOpacity
        : config.densityOpacity;
  const opacity = clamp(baseOpacity * (input.transitionOpacity ?? 1), 0, 1);

  return {
    fillColor: rgbaCssFromHex(input.colorKey, opacity),
    haloOpacity: input.selected ? 0.24 : input.hovered ? 0.14 : 0,
    haloRadius: input.pixelWorld * basePx * stateScale * 2.15,
    opacity,
    radius: input.pixelWorld * basePx * stateScale,
    strokeColor: input.selected
      ? rgbaCssFromHex(ATLAS_VISUAL_CONFIG.palette.selectedStroke, 0.72)
      : input.hovered
        ? rgbaCssFromHex(ATLAS_VISUAL_CONFIG.palette.hoverStroke, 0.44)
        : "transparent",
    strokeWidth: input.selected
      ? config.selectedStrokePx
      : input.hovered
        ? config.hoverStrokePx
        : 0,
  };
}

export function getDensityVisualStyle(
  sample: DensitySampleLike,
  pixelWorld: number,
): DensityVisualStyle {
  const weight = Math.sqrt(clamp(sample.weight, 0, 1));
  const config = ATLAS_VISUAL_CONFIG.density;
  const corePx = config.coreMinPx + weight * (config.coreMaxPx - config.coreMinPx);
  const coreAlpha = config.coreAlphaMin + weight * (config.coreAlphaMax - config.coreAlphaMin);
  const haloAlpha = config.haloAlphaMin + weight * (config.haloAlphaMax - config.haloAlphaMin);

  return {
    coreColor: rgbaCssFromHex(sample.colorKey, coreAlpha),
    coreRadius: pixelWorld * corePx,
    haloColor: rgbaCssFromHex(sample.colorKey, haloAlpha),
    haloRadius: pixelWorld * corePx * config.haloScale,
  };
}

export function getClusterVisualStyle(
  cluster: AtlasCluster,
  pixelWorld: number,
  hovered = false,
): {
  centerColor: string;
  centerRadius: number;
  fillColor: string;
  haloColor: string;
  haloRadius: number;
  radius: number;
  strokeColor: string;
  strokeWidth: number;
} {
  const countScale = clamp(Math.log10(cluster.pointCount + 10) / 4.2, 0, 1);
  const radiusPx =
    ATLAS_VISUAL_CONFIG.clusters.bubbleMinPx +
    countScale *
      (ATLAS_VISUAL_CONFIG.clusters.bubbleMaxPx -
        ATLAS_VISUAL_CONFIG.clusters.bubbleMinPx);
  const worldRadius = Math.max(
    pixelWorld * radiusPx,
    Math.min(cluster.radius * ATLAS_VISUAL_CONFIG.clusters.radiusScale, pixelWorld * radiusPx * 1.2),
  );

  return {
    centerColor: rgbaCssFromHex(
      cluster.colorKey,
      hovered
        ? ATLAS_VISUAL_CONFIG.clusters.centerAlpha + 0.12
        : ATLAS_VISUAL_CONFIG.clusters.centerAlpha,
    ),
    centerRadius: Math.max(pixelWorld * 3.2, worldRadius * 0.06),
    fillColor: rgbaCssFromHex(
      cluster.colorKey,
      hovered
        ? ATLAS_VISUAL_CONFIG.clusters.hoverFillAlpha
        : ATLAS_VISUAL_CONFIG.clusters.fillAlpha,
    ),
    haloColor: rgbaCssFromHex(
      cluster.colorKey,
      hovered
        ? ATLAS_VISUAL_CONFIG.clusters.haloAlpha * 1.8
        : ATLAS_VISUAL_CONFIG.clusters.haloAlpha,
    ),
    haloRadius: worldRadius * (hovered ? 1.55 : 1.38),
    radius: worldRadius,
    strokeColor: rgbaCssFromHex(
      cluster.colorKey,
      hovered
        ? ATLAS_VISUAL_CONFIG.clusters.hoverStrokeAlpha
        : ATLAS_VISUAL_CONFIG.clusters.strokeAlpha,
    ),
    strokeWidth: hovered ? 1.45 : 0.9,
  };
}

export function getContourVisualStyle(
  cluster: AtlasCluster,
  ring: number,
): {
  alpha: number;
  radius: number;
  width: number;
} {
  const config = ATLAS_VISUAL_CONFIG.contours;
  const safeRing = clamp(ring, 0, config.ringCount - 1);
  const baseRadius = clamp(
    cluster.radius * config.baseRadiusScale,
    config.minRadius,
    config.maxRadius,
  );

  return {
    alpha: config.alphaByRing[safeRing] ?? config.alphaByRing[config.alphaByRing.length - 1],
    radius: baseRadius * (0.78 + safeRing * config.ringSpacing),
    width: config.widthByRing[safeRing] ?? 0.5,
  };
}

function labelScore(cluster: AtlasCluster): number {
  return Math.log10(cluster.pointCount + 10) * (0.68 + cluster.importance * 0.72);
}

export function selectClusterLabels(input: {
  bbox?: { maxX: number; maxY: number; minX: number; minY: number };
  clusters: AtlasCluster[];
  lod: AtlasLodLayer;
  selectedClusterId?: string | null;
  spanX: number;
  spanY: number;
}): AtlasCluster[] {
  const labelConfig =
    input.lod === "density"
      ? ATLAS_VISUAL_CONFIG.labels.density
      : input.lod === "points"
        ? ATLAS_VISUAL_CONFIG.labels.points
        : ATLAS_VISUAL_CONFIG.labels.clusters;
  const pixelWorld = Math.max(input.spanX / 980, input.spanY / 720);
  const collision = pixelWorld * labelConfig.collisionPx;
  const selectedBoost = input.selectedClusterId ? 100 : 0;
  const edgePaddingX = input.spanX * labelConfig.edgePaddingRatio;
  const edgePaddingY = input.spanY * labelConfig.edgePaddingRatio;

  const sorted = input.clusters
    .filter((cluster) => {
      if (!input.bbox) return true;
      return (
        cluster.centroidX >= input.bbox.minX + edgePaddingX &&
        cluster.centroidX <= input.bbox.maxX - edgePaddingX &&
        cluster.centroidY >= input.bbox.minY + edgePaddingY &&
        cluster.centroidY <= input.bbox.maxY - edgePaddingY
      );
    })
    .sort((a, b) => {
      const aScore =
        labelScore(a) + (a.clusterId === input.selectedClusterId ? selectedBoost : 0);
      const bScore =
        labelScore(b) + (b.clusterId === input.selectedClusterId ? selectedBoost : 0);
      return bScore - aScore;
    });

  const placed: AtlasCluster[] = [];
  for (const cluster of sorted) {
    if (placed.length >= labelConfig.maxCount) break;
    const overlaps = placed.some((placedCluster) => {
      const dx = placedCluster.centroidX - cluster.centroidX;
      const dy = placedCluster.centroidY - cluster.centroidY;
      return Math.hypot(dx, dy) < collision;
    });
    if (!overlaps) placed.push(cluster);
  }

  return placed;
}

export function labelFontSize(lod: AtlasLodLayer, pixelWorld: number): number {
  const labelConfig =
    lod === "density"
      ? ATLAS_VISUAL_CONFIG.labels.density
      : lod === "points"
        ? ATLAS_VISUAL_CONFIG.labels.points
        : ATLAS_VISUAL_CONFIG.labels.clusters;
  const fontPx = clamp(labelConfig.fontMaxPx, labelConfig.fontMinPx, labelConfig.fontMaxPx);
  return pixelWorld * fontPx;
}

export function selectDensityLabels(input: {
  samples: DensitySampleLike[];
  spanX: number;
  spanY: number;
}): DensityLabel[] {
  const byLabel = new Map<
    string,
    {
      colorKey?: string;
      score: number;
      weightedX: number;
      weightedY: number;
      weight: number;
    }
  >();

  for (const sample of input.samples) {
    if (!sample.label || sample.weight < ATLAS_VISUAL_CONFIG.labels.density.minWeight) {
      continue;
    }
    const previous = byLabel.get(sample.label) ?? {
      colorKey: sample.colorKey,
      score: 0,
      weightedX: 0,
      weightedY: 0,
      weight: 0,
    };
    const weight = Math.max(sample.weight, 0.01);
    previous.score += weight;
    previous.weight += weight;
    previous.weightedX += sample.x * weight;
    previous.weightedY += sample.y * weight;
    byLabel.set(sample.label, previous);
  }

  const pixelWorld = Math.max(input.spanX / 980, input.spanY / 720);
  const collision = pixelWorld * ATLAS_VISUAL_CONFIG.labels.density.collisionPx;
  const candidates = Array.from(byLabel, ([label, value]) => ({
    colorKey: value.colorKey,
    id: `density-label-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    label,
    score: value.score,
    x: value.weightedX / value.weight,
    y: value.weightedY / value.weight,
  })).sort((a, b) => b.score - a.score);

  const placed: DensityLabel[] = [];
  for (const candidate of candidates) {
    if (placed.length >= ATLAS_VISUAL_CONFIG.labels.density.maxCount) break;
    const overlaps = placed.some((label) => {
      const dx = label.x - candidate.x;
      const dy = label.y - candidate.y;
      return Math.hypot(dx, dy) < collision;
    });
    if (!overlaps) placed.push(candidate);
  }

  return placed;
}
