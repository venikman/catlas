"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent,
  type PointerEvent,
  type SetStateAction,
  type WheelEvent,
} from "react";
import {
  ATLAS_DEFAULT_WORLD_BOUNDS,
  type AtlasWorldBounds,
} from "../../contract/atlasStore";
import {
  densityTilesToSamples,
  type DensitySample,
  type RenderedAtlasPoint,
} from "../../lib/atlas/rendering/buffers";
import { getAtlasLayerOpacities } from "../../lib/atlas/layerOpacity";
import { interpolatePointSet } from "../../lib/atlas/rendering/transitions";
import type {
  AtlasBbox,
  AtlasCluster,
  AtlasDensityTile,
  AtlasLodLayer,
  AtlasPoint,
} from "../../lib/atlas/types";
import {
  ATLAS_VISUAL_CONFIG,
  clampAtlasZoom,
  type AtlasPalette,
  getClusterVisualStyle,
  getContourVisualStyle,
  getDensityVisualStyle,
  getPointVisualStyle,
  labelFontSize,
  rgbaCssFromHex,
  selectClusterLabels,
  selectDensityLabels,
} from "../../lib/atlas/visualConfig";
import type { AtlasViewportState, LayerToggles } from "./atlasComponentTypes";
import { viewSpanForWorldBounds } from "./viewportBounds";

type AtlasTargetMarker = {
  id: string;
  label?: string;
  x: number;
  y: number;
};

type AtlasCanvasProps = {
  bbox: AtlasBbox;
  clusters: AtlasCluster[];
  densityTiles: AtlasDensityTile[];
  hoveredEntityId: string | null;
  layers: LayerToggles;
  lod: AtlasLodLayer;
  onHoverCluster: (cluster: AtlasCluster | null) => void;
  onHoverPoint: (point: AtlasPoint | null) => void;
  onSelectCluster: (cluster: AtlasCluster) => void;
  onSelectPoint: (point: AtlasPoint) => void;
  palette?: AtlasPalette;
  points: AtlasPoint[];
  renderedCount?: number;
  selectedEntityId: string | null;
  setViewport: Dispatch<SetStateAction<AtlasViewportState>>;
  targetMarker: AtlasTargetMarker | null;
  viewport: AtlasViewportState;
  worldBounds?: AtlasWorldBounds;
};

type AtlasContourPath = {
  clusterId: string;
  color: string;
  id: string;
  path: [number, number, number][];
  width: number;
};

type AtlasDensityRegion = {
  colorKey: string;
  id: string;
  outerPath: [number, number, number][];
  path: [number, number, number][];
  score: number;
};

type AtlasDensityStipplePoint = {
  colorKey: string;
  id: string;
  opacity: number;
  radius: number;
  x: number;
  y: number;
};

type AtlasDensityGroupAnchor = {
  centerX: number;
  centerY: number;
  colorKey: string;
  key: string;
  samples: DensitySample[];
  score: number;
  spread: number;
  weight: number;
};

type AtlasBranchPath = {
  clusterId: string;
  colorKey?: string;
  d: string;
  entityId: string;
  importance: number;
};

type DragState = {
  centerX: number;
  centerY: number;
  clientX: number;
  clientY: number;
  moved: boolean;
  spanX: number;
  spanY: number;
};

type CanvasSize = {
  height: number;
  width: number;
};

type CanvasTransform = {
  offsetX: number;
  offsetY: number;
  scale: number;
};

const CANVAS_ROOT_BASE_STYLE: CSSProperties = {
  inset: 0,
  overflow: "hidden",
  position: "absolute",
};

const CANVAS_GLOW_STYLE: CSSProperties = {
  display: "none",
  inset: 0,
  pointerEvents: "none",
  position: "absolute",
  zIndex: 1,
};

const CANVAS_TEXTURE_STYLE: CSSProperties = {
  height: "100%",
  inset: 0,
  pointerEvents: "none",
  position: "absolute",
  width: "100%",
  zIndex: 2,
};

const CANVAS_SVG_STYLE: CSSProperties = {
  cursor: "grab",
  height: "100%",
  inset: 0,
  position: "absolute",
  touchAction: "none",
  width: "100%",
  zIndex: 3,
};

const CANVAS_GRID_OVERLAY_STYLE: CSSProperties = {
  display: "none",
  inset: 0,
  opacity: 0,
  pointerEvents: "none",
  position: "absolute",
  zIndex: 3,
};

const CANVAS_GRID_SVG_STYLE: CSSProperties = {
  height: "100%",
  width: "100%",
};

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomNormal(random: () => number): number {
  const u = Math.max(random(), 0.000001);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function atlasTextureColor(
  colorKey: string | undefined,
  random: () => number,
  neutralRate: number,
  fallback: string,
): string {
  if (random() > neutralRate) {
    return colorKey ?? fallback;
  }

  const neutralPalette = [
    "#27323a",
    "#3a444a",
    "#515b61",
    "#6a6963",
    "#817c73",
  ];
  return neutralPalette[Math.floor(random() * neutralPalette.length)] ?? "#475569";
}

function canvasTransform(
  size: CanvasSize,
  spanX: number,
  spanY: number,
): CanvasTransform {
  const scale = Math.max(size.width / spanX, size.height / spanY);
  return {
    offsetX: (size.width - spanX * scale) / 2,
    offsetY: (size.height - spanY * scale) / 2,
    scale,
  };
}

function projectWorldPoint(input: {
  bbox: AtlasBbox;
  transform: CanvasTransform;
  x: number;
  y: number;
}): { x: number; y: number } {
  return {
    x: (input.x - input.bbox.minX) * input.transform.scale + input.transform.offsetX,
    y: (input.y - input.bbox.minY) * input.transform.scale + input.transform.offsetY,
  };
}

function unprojectScreenPoint(input: {
  bbox: AtlasBbox;
  transform: CanvasTransform;
  x: number;
  y: number;
}): { x: number; y: number } {
  return {
    x: (input.x - input.transform.offsetX) / input.transform.scale + input.bbox.minX,
    y: (input.y - input.transform.offsetY) / input.transform.scale + input.bbox.minY,
  };
}

function drawTextureDot(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
) {
  if (radius <= 0.95) {
    const size = Math.max(0.75, radius * 1.7);
    context.fillRect(x - size / 2, y - size / 2, size, size);
    return;
  }

  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function buildBlobPath(input: {
  centerX: number;
  centerY: number;
  phase: number;
  radius: number;
  xBias: number;
  yBias: number;
}): [number, number, number][] {
  const path: [number, number, number][] = [];

  for (let index = 0; index <= 72; index += 1) {
    const theta = (index / 72) * Math.PI * 2;
    const wobble =
      1 +
      Math.sin(theta * 2 + input.phase) * 0.11 +
      Math.sin(theta * 5 + input.phase * 0.63) * 0.055 +
      Math.cos(theta * 3 - input.phase * 0.4) * 0.038;
    path.push([
      input.centerX + Math.cos(theta) * input.radius * input.xBias * wobble,
      input.centerY + Math.sin(theta) * input.radius * input.yBias * wobble,
      0,
    ]);
  }

  return path;
}

function buildDensityRegions(
  samples: DensitySample[],
  pixelWorld: number,
): AtlasDensityRegion[] {
  const groups = new Map<
    string,
    {
      colorKey: string;
      score: number;
      weightedX: number;
      weightedY: number;
      weight: number;
      samples: DensitySample[];
    }
  >();

  for (const sample of samples) {
    const key = sample.label ?? sample.colorKey ?? sample.id;
    const weight = Math.max(sample.weight, 0.01);
    const group = groups.get(key) ?? {
      colorKey: sample.colorKey,
      score: 0,
      samples: [],
      weight: 0,
      weightedX: 0,
      weightedY: 0,
    };
    group.score += weight;
    group.weight += weight;
    group.weightedX += sample.x * weight;
    group.weightedY += sample.y * weight;
    group.samples.push(sample);
    groups.set(key, group);
  }

  return Array.from(groups, ([key, group]) => {
    const centerX = group.weightedX / group.weight;
    const centerY = group.weightedY / group.weight;
    const spread =
      group.samples.reduce((total, sample) => {
        const dx = sample.x - centerX;
        const dy = sample.y - centerY;
        return total + Math.hypot(dx, dy) * Math.max(sample.weight, 0.01);
      }, 0) / group.weight;
    const seed = hashString(key);
    const phase = (seed % 628) / 100;
    const config = ATLAS_VISUAL_CONFIG.regions;
    const radius = clampNumber(
      spread * config.spreadScale + pixelWorld * (68 + Math.sqrt(group.score) * 15),
      pixelWorld * config.minRadiusPx,
      pixelWorld * config.maxRadiusPx,
    );
    const xBias = 1.08 + ((seed % 7) - 3) * 0.028;
    const yBias = 0.72 + (((seed >> 3) % 7) - 3) * 0.026;

    return {
      colorKey: group.colorKey,
      id: `density-region-${key.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      outerPath: buildBlobPath({
        centerX,
        centerY,
        phase: phase + 0.31,
        radius: radius * 1.18,
        xBias,
        yBias,
      }),
      path: buildBlobPath({ centerX, centerY, phase, radius, xBias, yBias }),
      score: group.score,
    };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, ATLAS_VISUAL_CONFIG.regions.maxCount);
}

function buildClusterContours(clusters: AtlasCluster[]): AtlasContourPath[] {
  const paths: AtlasContourPath[] = [];

  for (const cluster of clusters) {
    const seed = hashString(cluster.id);
    const phase = (seed % 628) / 100;
    const xBias = 0.94 + ((seed % 9) - 4) * 0.02;
    const yBias = 0.78 + (((seed >> 3) % 9) - 4) * 0.02;

    for (let ring = 0; ring < ATLAS_VISUAL_CONFIG.contours.ringCount; ring += 1) {
      const visual = getContourVisualStyle(cluster, ring);
      const path: [number, number, number][] = [];

      for (let index = 0; index <= 96; index += 1) {
        const theta = (index / 96) * Math.PI * 2;
        const wobble =
          1 +
          Math.sin(theta * 3 + phase) * 0.085 +
          Math.sin(theta * 7 + phase * 0.7) * 0.046;
        const rx = visual.radius * wobble * xBias;
        const ry = visual.radius * wobble * yBias;
        path.push([
          cluster.centroidX + Math.cos(theta) * rx,
          cluster.centroidY + Math.sin(theta) * ry,
          0,
        ]);
      }

      paths.push({
        clusterId: cluster.clusterId,
        color: rgbaCssFromHex(cluster.colorKey, visual.alpha),
        id: `${cluster.id}-contour-${ring}`,
        path,
        width: visual.width,
      });
    }
  }

  return paths;
}

function buildDensityStipple(
  samples: DensitySample[],
  pixelWorld: number,
  palette: AtlasPalette,
): AtlasDensityStipplePoint[] {
  const groups = new Map<
    string,
    {
      colorKey: string;
      samples: DensitySample[];
      score: number;
      weight: number;
      weightedX: number;
      weightedY: number;
    }
  >();

  for (const sample of samples) {
    const key = sample.label ?? sample.colorKey ?? sample.id;
    const weight = Math.max(sample.weight, 0.01);
    const group = groups.get(key) ?? {
      colorKey: sample.colorKey,
      samples: [],
      score: 0,
      weight: 0,
      weightedX: 0,
      weightedY: 0,
    };
    group.samples.push(sample);
    group.score += weight;
    group.weight += weight;
    group.weightedX += sample.x * weight;
    group.weightedY += sample.y * weight;
    groups.set(key, group);
  }

  const groupAnchors: AtlasDensityGroupAnchor[] = Array.from(
    groups,
    ([key, group]) => {
      const centerX = group.weightedX / group.weight;
      const centerY = group.weightedY / group.weight;
      const spread =
        group.samples.reduce((total, sample) => {
          const dx = sample.x - centerX;
          const dy = sample.y - centerY;
          return total + Math.hypot(dx, dy) * Math.max(sample.weight, 0.01);
        }, 0) / group.weight;

      return {
        centerX,
        centerY,
        colorKey: group.colorKey,
        key,
        samples: group.samples,
        score: group.score,
        spread,
        weight: group.weight,
      };
    },
  ).sort((a, b) => b.score - a.score);

  const points: AtlasDensityStipplePoint[] = [];
  const maxCount = 216000;
  const ambientReserve = Math.min(
    34000,
    Math.max(14000, Math.round(samples.length * 110)),
  );
  const interstitialReserve = Math.min(
    56000,
    Math.max(36000, Math.round(samples.length * 220)),
  );
  const textureLimit = Math.max(0, maxCount - ambientReserve - interstitialReserve);

  for (const [key, group] of Array.from(groups).sort((a, b) => b[1].score - a[1].score)) {
    const centerX = group.weightedX / group.weight;
    const centerY = group.weightedY / group.weight;
    const spread =
      group.samples.reduce((total, sample) => {
        const dx = sample.x - centerX;
        const dy = sample.y - centerY;
        return total + Math.hypot(dx, dy) * Math.max(sample.weight, 0.01);
      }, 0) / group.weight;
    const random = seededRandom(hashString(key));
    const cloudRadius = clampNumber(
      spread * 1.18 + pixelWorld * (58 + Math.sqrt(group.score) * 17),
      pixelWorld * 58,
      pixelWorld * 240,
    );
    const lobeCount = Math.min(
      8,
      Math.max(3, Math.round(2 + Math.sqrt(group.samples.length) / 3.2)),
    );
    const lobes = Array.from({ length: lobeCount }, (_, index) => {
      const sample = group.samples[Math.floor(random() * group.samples.length)] ?? group.samples[0];
      const anchorBlend = 0.64 + random() * 0.22;
      const radiusBase = clampNumber(
        spread * (0.26 + random() * 0.24) + pixelWorld * (24 + random() * 58),
        pixelWorld * 18,
        pixelWorld * 128,
      );

      return {
        colorKey: sample?.colorKey ?? group.colorKey,
        radiusX: radiusBase * (0.78 + random() * 0.8),
        radiusY: radiusBase * (0.52 + random() * 0.74),
        rotation: random() * Math.PI,
        x:
          (sample?.x ?? centerX) * anchorBlend +
          centerX * (1 - anchorBlend) +
          randomNormal(random) * cloudRadius * 0.09,
        y:
          (sample?.y ?? centerY) * anchorBlend +
          centerY * (1 - anchorBlend) +
          randomNormal(random) * cloudRadius * 0.08,
      };
    });
    const count = Math.min(
      7800,
      Math.max(1040, Math.round(group.samples.length * 56 + Math.sqrt(group.score) * 310)),
    );

    for (let index = 0; index < count && points.length < textureLimit; index += 1) {
      const lobe = lobes[Math.floor(random() * lobes.length)] ?? lobes[0];
      const localX = clampNumber(randomNormal(random), -1.82, 1.82) * lobe.radiusX;
      const localY = clampNumber(randomNormal(random), -1.74, 1.74) * lobe.radiusY;
      const cos = Math.cos(lobe.rotation);
      const sin = Math.sin(lobe.rotation);
      const dust = random() < 0.08 ? cloudRadius * (0.08 + random() * 0.18) : 0;
      const dustAngle = random() * Math.PI * 2;
      const noiseX = randomNormal(random) * pixelWorld * 3.2 + Math.cos(dustAngle) * dust;
      const noiseY = randomNormal(random) * pixelWorld * 3.2 + Math.sin(dustAngle) * dust;

      points.push({
        colorKey: atlasTextureColor(lobe.colorKey, random, 0.32, palette.fallback),
        id: `${key}-stipple-${index}`,
        opacity: 0.26 + Math.min(0.48, Math.sqrt(group.score) * 0.052) + random() * 0.16,
        radius: pixelWorld * (0.13 + random() * 0.31),
        x: lobe.x + localX * cos - localY * sin + noiseX,
        y: lobe.y + localX * sin + localY * cos + noiseY,
      });
    }

    for (const sample of group.samples) {
      const sampleRandom = seededRandom(hashString(`${sample.id}-micro-stipple`));
      const sampleCount = Math.min(
        118,
        Math.max(28, Math.round(28 + sample.weight * 36)),
      );
      const sampleSpread = pixelWorld * (9 + sampleRandom() * 24);
      const sampleRotation = sampleRandom() * Math.PI;
      const sampleRx = sampleSpread * (0.7 + sampleRandom() * 0.8);
      const sampleRy = sampleSpread * (0.45 + sampleRandom() * 0.58);
      const sampleCos = Math.cos(sampleRotation);
      const sampleSin = Math.sin(sampleRotation);

      for (
        let sampleIndex = 0;
        sampleIndex < sampleCount && points.length < textureLimit;
        sampleIndex += 1
      ) {
        const localX = clampNumber(randomNormal(sampleRandom), -2.4, 2.4) * sampleRx;
        const localY = clampNumber(randomNormal(sampleRandom), -2.2, 2.2) * sampleRy;
        points.push({
          colorKey: atlasTextureColor(sample.colorKey, sampleRandom, 0.28, palette.fallback),
          id: `${sample.id}-micro-${sampleIndex}`,
          opacity:
            0.28 +
            Math.min(0.5, Math.sqrt(sample.weight) * 0.15) +
            sampleRandom() * 0.12,
          radius: pixelWorld * (0.12 + sampleRandom() * 0.31),
          x: sample.x + localX * sampleCos - localY * sampleSin,
          y: sample.y + localX * sampleSin + localY * sampleCos,
        });
      }

      if (points.length >= textureLimit) break;
    }

    if (points.length >= textureLimit) break;
  }

  if (samples.length > 0 && points.length < maxCount) {
    const totalWeight = samples.reduce(
      (total, sample) => total + Math.max(sample.weight, 0.01),
      0,
    );
    const centerX =
      samples.reduce(
        (total, sample) => total + sample.x * Math.max(sample.weight, 0.01),
        0,
      ) / totalWeight;
    const centerY =
      samples.reduce(
        (total, sample) => total + sample.y * Math.max(sample.weight, 0.01),
        0,
      ) / totalWeight;
    const globalSpread =
      samples.reduce((total, sample) => {
        const dx = sample.x - centerX;
        const dy = sample.y - centerY;
        return total + Math.hypot(dx, dy) * Math.max(sample.weight, 0.01);
      }, 0) / totalWeight;
    const ambientRandom = seededRandom(hashString("density-ambient-stipple"));
    const ambientCount = Math.min(maxCount - points.length, ambientReserve);

    for (let index = 0; index < ambientCount; index += 1) {
      const sample = samples[Math.floor(ambientRandom() * samples.length)] ?? samples[0];
      const neighbor =
        samples[Math.floor(ambientRandom() * samples.length)] ?? sample;
      const bridgeMix = ambientRandom();
      const centerPull = 0.16 + ambientRandom() * 0.46;
      const bridgeX =
        sample.x * (1 - bridgeMix) + neighbor.x * bridgeMix;
      const bridgeY =
        sample.y * (1 - bridgeMix) + neighbor.y * bridgeMix;
      const useBridge = ambientRandom() < 0.42;
      const x = useBridge
        ? bridgeX
        : sample.x * (1 - centerPull) + centerX * centerPull;
      const y = useBridge
        ? bridgeY
        : sample.y * (1 - centerPull) + centerY * centerPull;

      points.push({
        colorKey: atlasTextureColor(sample.colorKey, ambientRandom, 0.74, palette.fallback),
        id: `density-ambient-${index}`,
        opacity: 0.11 + Math.min(0.19, Math.sqrt(sample.weight) * 0.05),
        radius: pixelWorld * (0.09 + ambientRandom() * 0.17),
        x: x + randomNormal(ambientRandom) * globalSpread * 0.048,
        y: y + randomNormal(ambientRandom) * globalSpread * 0.043,
      });
    }

    if (groupAnchors.length > 1 && points.length < maxCount) {
      const interstitialRandom = seededRandom(
        hashString("density-interstitial-stipple"),
      );
      const interstitialCount = Math.min(
        maxCount - points.length,
        interstitialReserve,
      );

      for (let index = 0; index < interstitialCount; index += 1) {
        const first =
          groupAnchors[Math.floor(interstitialRandom() * groupAnchors.length)] ??
          groupAnchors[0];
        const second =
          groupAnchors[Math.floor(interstitialRandom() * groupAnchors.length)] ??
          first;
        const firstSample =
          first.samples[Math.floor(interstitialRandom() * first.samples.length)] ??
          first.samples[0];
        const secondSample =
          second.samples[Math.floor(interstitialRandom() * second.samples.length)] ??
          second.samples[0] ??
          firstSample;
        if (!firstSample || !secondSample) continue;

        const sampleMix = interstitialRandom();
        const groupMix = interstitialRandom();
        const sampleX =
          firstSample.x * (1 - sampleMix) + secondSample.x * sampleMix;
        const sampleY =
          firstSample.y * (1 - sampleMix) + secondSample.y * sampleMix;
        const groupX = first.centerX * (1 - groupMix) + second.centerX * groupMix;
        const groupY = first.centerY * (1 - groupMix) + second.centerY * groupMix;
        const bridgeWeight = 0.68 + interstitialRandom() * 0.16;
        const jitter =
          Math.min(
            globalSpread * 0.075,
            pixelWorld * (42 + interstitialRandom() * 92),
          ) +
          Math.min(first.spread + second.spread, globalSpread) * 0.018;
        const sourceColor =
          interstitialRandom() < 0.5 ? firstSample.colorKey : secondSample.colorKey;

        points.push({
          colorKey: atlasTextureColor(sourceColor, interstitialRandom, 0.82, palette.fallback),
          id: `density-interstitial-${index}`,
          opacity: 0.065 + interstitialRandom() * 0.11,
          radius: pixelWorld * (0.07 + interstitialRandom() * 0.15),
          x:
            sampleX * bridgeWeight +
            groupX * (1 - bridgeWeight) +
            randomNormal(interstitialRandom) * jitter,
          y:
            sampleY * bridgeWeight +
            groupY * (1 - bridgeWeight) +
            randomNormal(interstitialRandom) * jitter,
        });
      }
    }
  }

  return points;
}

function buildPointContextStipple(
  points: RenderedAtlasPoint[],
  pixelWorld: number,
  lod: AtlasLodLayer,
  palette: AtlasPalette,
): AtlasDensityStipplePoint[] {
  if (points.length === 0 || lod === "density") return [];

  const isClusterLod = lod === "clusters";
  const maxCount = isClusterLod ? 52000 : 90000;
  const texturePoints: AtlasDensityStipplePoint[] = [];
  const sortedPoints = [...points].sort((a, b) => {
    const scoreDelta = b.importance - a.importance;
    return scoreDelta !== 0 ? scoreDelta : a.entityId.localeCompare(b.entityId);
  });

  for (const point of sortedPoints) {
    if (texturePoints.length >= maxCount) break;

    const random = seededRandom(hashString(`${point.entityId}-${lod}-context`));
    const importance = clampNumber(point.importance, 0, 1);
    const count = isClusterLod
      ? Math.round(24 + importance * 46)
      : Math.round(15 + importance * 28);
    const spread = pixelWorld * (
      isClusterLod
        ? 9 + random() * 22 + importance * 18
        : 4 + random() * 10 + importance * 9
    );
    const rotation = random() * Math.PI;
    const rx = spread * (0.75 + random() * 0.72);
    const ry = spread * (0.48 + random() * 0.56);
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    for (let index = 0; index < count && texturePoints.length < maxCount; index += 1) {
      const localX = clampNumber(randomNormal(random), -2.35, 2.35) * rx;
      const localY = clampNumber(randomNormal(random), -2.1, 2.1) * ry;
      const satellite = isClusterLod && random() < 0.18
        ? pixelWorld * (18 + random() * 52)
        : 0;
      const satelliteAngle = random() * Math.PI * 2;

      texturePoints.push({
        colorKey: atlasTextureColor(point.colorKey, random, isClusterLod ? 0.18 : 0.12, palette.fallback),
        id: `${point.entityId}-context-${index}`,
        opacity: isClusterLod
          ? 0.2 + importance * 0.22 + random() * 0.08
          : 0.21 + importance * 0.24 + random() * 0.08,
        radius: pixelWorld * (
          isClusterLod
            ? 0.11 + random() * 0.27
            : 0.08 + random() * 0.22
        ),
        x:
          point.x +
          localX * cos -
          localY * sin +
          Math.cos(satelliteAngle) * satellite,
        y:
          point.y +
          localX * sin +
          localY * cos +
          Math.sin(satelliteAngle) * satellite,
      });
    }
  }

  if (isClusterLod && texturePoints.length < maxCount && sortedPoints.length > 1) {
    const bridgeRandom = seededRandom(hashString(`cluster-bridges-${sortedPoints.length}`));
    const bridgeCount = Math.min(maxCount - texturePoints.length, sortedPoints.length * 10);

    for (let index = 0; index < bridgeCount; index += 1) {
      const start = sortedPoints[Math.floor(bridgeRandom() * sortedPoints.length)] ?? sortedPoints[0];
      const end = sortedPoints[Math.floor(bridgeRandom() * sortedPoints.length)] ?? start;
      const mix = bridgeRandom();
      const x = start.x * (1 - mix) + end.x * mix;
      const y = start.y * (1 - mix) + end.y * mix;

      texturePoints.push({
        colorKey:
          start.colorKey ?? end.colorKey ?? palette.fallback,
        id: `cluster-bridge-${index}`,
        opacity: 0.08 + bridgeRandom() * 0.08,
        radius: pixelWorld * (0.08 + bridgeRandom() * 0.16),
        x: x + randomNormal(bridgeRandom) * pixelWorld * 18,
        y: y + randomNormal(bridgeRandom) * pixelWorld * 16,
      });
    }
  }

  return texturePoints;
}

function buildBranchPaths(
  clusters: AtlasCluster[],
  points: AtlasPoint[],
  pixelWorld: number,
): AtlasBranchPath[] {
  const clusterById = new Map(clusters.map((cluster) => [cluster.clusterId, cluster]));
  const branchCounts = new Map<string, number>();
  const config = ATLAS_VISUAL_CONFIG.branches;
  const sortedPoints = points
    .filter((point) => point.importance >= config.minImportance)
    .sort((a, b) => b.importance - a.importance);
  const branches: AtlasBranchPath[] = [];

  for (const point of sortedPoints) {
    const cluster = clusterById.get(point.clusterId);
    if (!cluster) continue;

    const used = branchCounts.get(cluster.clusterId) ?? 0;
    if (used >= config.maxPerCluster || branches.length >= config.maxCount) continue;

    const dx = point.x - cluster.centroidX;
    const dy = point.y - cluster.centroidY;
    const distance = Math.hypot(dx, dy);
    if (distance < pixelWorld * 10) continue;

    const seed = hashString(point.entityId);
    const bend = (((seed % 100) / 100) - 0.5) * config.curveScale * distance;
    const normalX = distance === 0 ? 0 : -dy / distance;
    const normalY = distance === 0 ? 0 : dx / distance;
    const controlX = cluster.centroidX + dx * 0.58 + normalX * bend;
    const controlY = cluster.centroidY + dy * 0.58 + normalY * bend;

    branches.push({
      clusterId: cluster.clusterId,
      colorKey: point.colorKey ?? cluster.colorKey,
      d: [
        `M ${cluster.centroidX.toFixed(4)} ${cluster.centroidY.toFixed(4)}`,
        `Q ${controlX.toFixed(4)} ${controlY.toFixed(4)}`,
        `${point.x.toFixed(4)} ${point.y.toFixed(4)}`,
      ].join(" "),
      entityId: point.entityId,
      importance: point.importance,
    });
    branchCounts.set(cluster.clusterId, used + 1);
  }

  return branches;
}

function useInterpolatedPoints(points: AtlasPoint[]): RenderedAtlasPoint[] {
  const previousRef = useRef<AtlasPoint[]>(points);
  const rafRef = useRef<number | null>(null);
  const [rendered, setRendered] = useState<RenderedAtlasPoint[]>(points);

  useEffect(() => {
    const previous = previousRef.current;
    if (previous === points) return;

    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(
        1,
        (now - startedAt) / ATLAS_VISUAL_CONFIG.animation.viewSwitchMs,
      );
      setRendered(interpolatePointSet(previous, points, progress));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        previousRef.current = points;
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [points]);

  return rendered;
}

function pathToD(path: [number, number, number][]): string {
  return path
    .map(
      ([x, y], index) =>
        `${index === 0 ? "M" : "L"} ${x.toFixed(4)} ${y.toFixed(4)}`,
    )
    .join(" ");
}

function formatMapLabel(label: string): string {
  const normalized = label.replace(/[-_]+/g, " ");
  if (!/^[a-z0-9 ]+$/.test(normalized)) return normalized;

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function mapLabel(label: string, maxLength: number): string {
  const formatted = formatMapLabel(label);
  if (formatted.length <= maxLength) return formatted;
  return `${formatted.slice(0, maxLength - 3)}...`;
}

function clusterSelectLabel(cluster: AtlasCluster): string {
  return cluster.label
    ? `Select cluster: ${cluster.label}`
    : `Select cluster ${cluster.clusterId}`;
}

export function AtlasCanvas({
  bbox,
  clusters,
  densityTiles,
  hoveredEntityId,
  layers,
  lod,
  onHoverCluster,
  onHoverPoint,
  onSelectCluster,
  onSelectPoint,
  palette = ATLAS_VISUAL_CONFIG.palette,
  points,
  renderedCount,
  selectedEntityId,
  setViewport,
  targetMarker,
  viewport,
  worldBounds = ATLAS_DEFAULT_WORLD_BOUNDS,
}: AtlasCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ height: 0, width: 0 });
  const [hoveredClusterId, setHoveredClusterId] = useState<string | null>(null);
  const [activeClusterIndex, setActiveClusterIndex] = useState(0);
  const clusterHitRefs = useRef<Array<SVGCircleElement | null>>([]);
  const renderedPoints = useInterpolatedPoints(points);

  const densitySamples = useMemo(
    () => densityTilesToSamples(densityTiles),
    [densityTiles],
  );

  const spanX = bbox.maxX - bbox.minX;
  const spanY = bbox.maxY - bbox.minY;
  const rootStyle = useMemo<CSSProperties>(
    () => ({
      ...CANVAS_ROOT_BASE_STYLE,
      background: palette.paper,
    }),
    [palette.paper],
  );
  const [surfaceFocused, setSurfaceFocused] = useState(false);
  const interactiveRootStyle = useMemo<CSSProperties>(
    () =>
      surfaceFocused
        ? {
            ...rootStyle,
            boxShadow: `inset 0 0 0 2px ${palette.selectedStroke}`,
          }
        : rootStyle,
    [palette.selectedStroke, rootStyle, surfaceFocused],
  );
  const mapAriaLabel = useMemo(() => {
    const count = renderedCount ?? points.length;
    return `Semantic atlas map. ${count} points rendered. Use arrow keys to pan and plus or minus to zoom.`;
  }, [points.length, renderedCount]);
  const pixelWorld = Math.max(spanX / 980, spanY / 720);
  const densityRegions = useMemo(
    () => buildDensityRegions(densitySamples, pixelWorld),
    [densitySamples, pixelWorld],
  );
  const densityStipple = useMemo(
    () => buildDensityStipple(densitySamples, pixelWorld, palette),
    [densitySamples, palette, pixelWorld],
  );
  const pointContextStipple = useMemo(
    () => buildPointContextStipple(renderedPoints, pixelWorld, lod, palette),
    [lod, palette, pixelWorld, renderedPoints],
  );
  const contourPaths = useMemo(() => buildClusterContours(clusters), [clusters]);
  const layerOpacities = useMemo(
    () => getAtlasLayerOpacities(viewport.zoom),
    [viewport.zoom],
  );
  const densityLayerOpacity = layers.density ? layerOpacities.density : 0;
  const densityTextureOpacity = layers.density
    ? Math.max(
        densityLayerOpacity,
        lod === "clusters" ? 0.28 : lod === "points" ? 0.16 : 0,
      )
    : 0;
  const clusterLayerOpacity = layers.clusters ? layerOpacities.clusters : 0;
  const branchLayerOpacity =
    layers.links && layers.clusters ? layerOpacities.branches : 0;
  const pointLayerOpacity = layers.points
    ? lod === "points"
      ? Math.max(0.68, layerOpacities.points)
      : lod === "clusters"
        ? Math.max(0.46, layerOpacities.clusters * 0.82)
        : 0
    : 0;
  const clusterLabelSize = labelFontSize("clusters", pixelWorld);
  const densityLabelSize = labelFontSize("density", pixelWorld);

  const clusterLabels = useMemo(
    () =>
      selectClusterLabels({
        bbox,
        clusters,
        lod,
        spanX,
        spanY,
      }),
    [bbox, clusters, lod, spanX, spanY],
  );
  const densityLabels = useMemo(
    () => selectDensityLabels({ samples: densitySamples, spanX, spanY }),
    [densitySamples, spanX, spanY],
  );
  const branchPaths = useMemo(
    () => buildBranchPaths(clusters, renderedPoints, pixelWorld),
    [clusters, renderedPoints, pixelWorld],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setCanvasSize({
        height: Math.max(1, Math.round(rect.height)),
        width: Math.max(1, Math.round(rect.width)),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasSize.width <= 0 || canvasSize.height <= 0) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const deviceScale = window.devicePixelRatio || 1;
    const pixelWidth = Math.max(1, Math.round(canvasSize.width * deviceScale));
    const pixelHeight = Math.max(1, Math.round(canvasSize.height * deviceScale));

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
    context.clearRect(0, 0, canvasSize.width, canvasSize.height);
    context.lineCap = "round";
    context.lineJoin = "round";

    const transform = canvasTransform(canvasSize, spanX, spanY);

    if (layers.density && densityTextureOpacity > 0 && densityStipple.length > 0) {
      context.save();
      context.globalAlpha = densityTextureOpacity;
      for (const point of densityStipple) {
        const screen = projectWorldPoint({
          bbox,
          transform,
          x: point.x,
          y: point.y,
        });
        const radius = clampNumber(point.radius * transform.scale, 0.55, 2.5);
        context.fillStyle = rgbaCssFromHex(point.colorKey, point.opacity, palette);
        drawTextureDot(context, screen.x, screen.y, radius);
      }
      context.restore();
    }

    if (layers.density && densityTextureOpacity > 0 && densitySamples.length > 0) {
      context.save();
      context.globalAlpha = densityTextureOpacity * 0.2;
      for (const sample of densitySamples) {
        const screen = projectWorldPoint({
          bbox,
          transform,
          x: sample.x,
          y: sample.y,
        });
        const style = getDensityVisualStyle(sample, pixelWorld, palette);
        const haloRadius = clampNumber(style.haloRadius * transform.scale, 3, 48);
        const coreRadius = clampNumber(style.coreRadius * transform.scale, 1, 13);
        const gradient = context.createRadialGradient(
          screen.x,
          screen.y,
          0,
          screen.x,
          screen.y,
          haloRadius,
        );
        gradient.addColorStop(0, style.coreColor);
        gradient.addColorStop(0.42, style.haloColor);
        gradient.addColorStop(1, rgbaCssFromHex(sample.colorKey, 0, palette));
        context.beginPath();
        context.fillStyle = gradient;
        context.arc(screen.x, screen.y, haloRadius, 0, Math.PI * 2);
        context.fill();
        if (sample.weight > 0.45) {
          context.beginPath();
          context.fillStyle = style.coreColor;
          context.arc(screen.x, screen.y, coreRadius, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.restore();
    }

    if (layers.points && pointLayerOpacity > 0 && pointContextStipple.length > 0) {
      context.save();
      context.globalAlpha = lod === "clusters"
        ? Math.min(0.82, pointLayerOpacity * 0.92)
        : Math.min(0.86, pointLayerOpacity * 0.78);
      for (const point of pointContextStipple) {
        const screen = projectWorldPoint({
          bbox,
          transform,
          x: point.x,
          y: point.y,
        });
        const radius = clampNumber(
          point.radius * transform.scale,
          lod === "clusters" ? 0.45 : 0.48,
          lod === "clusters" ? 2.2 : 2,
        );
        context.fillStyle = rgbaCssFromHex(point.colorKey, point.opacity, palette);
        drawTextureDot(context, screen.x, screen.y, radius);
      }
      context.restore();
    }

    if (layers.points && pointLayerOpacity > 0 && renderedPoints.length > 0) {
      context.save();
      context.globalAlpha = lod === "points"
        ? Math.min(0.6, pointLayerOpacity)
        : pointLayerOpacity;
      for (const point of renderedPoints) {
        const selected = point.entityId === selectedEntityId;
        const hovered = point.entityId === hoveredEntityId;
        const style = getPointVisualStyle(
          {
            colorKey: point.colorKey,
            hovered,
            importance: point.importance,
            lod,
            pixelWorld,
            selected,
            transitionOpacity: point.renderOpacity ?? 1,
          },
          palette,
        );
        const screen = projectWorldPoint({
          bbox,
          transform,
          x: point.x,
          y: point.y,
        });
        const radius = clampNumber(
          style.radius * transform.scale,
          lod === "points" ? 0.42 : 0.65,
          selected || hovered ? 12 : lod === "points" ? 1.75 : 3.8,
        );

        if (style.haloOpacity > 0) {
          context.beginPath();
          context.fillStyle = rgbaCssFromHex(point.colorKey, style.haloOpacity, palette);
          context.arc(screen.x, screen.y, radius * 2.4, 0, Math.PI * 2);
          context.fill();
        }

        context.beginPath();
        context.fillStyle = style.fillColor;
        context.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
        context.fill();

        if (style.strokeWidth > 0) {
          context.globalAlpha = 1;
          context.lineWidth = style.strokeWidth;
          context.strokeStyle = style.strokeColor;
          context.stroke();
          context.globalAlpha = pointLayerOpacity;
        }
      }
      context.restore();
    }
  }, [
    bbox,
    canvasSize,
    densityLayerOpacity,
    densitySamples,
    densityStipple,
    densityTextureOpacity,
    hoveredEntityId,
    layers.density,
    layers.points,
    lod,
    palette,
    pixelWorld,
    pointContextStipple,
    pointLayerOpacity,
    renderedPoints,
    selectedEntityId,
    spanX,
    spanY,
  ]);

  function nearestCanvasPoint(clientX: number, clientY: number): AtlasPoint | null {
    const rect = containerRef.current?.getBoundingClientRect();
    if (
      !rect ||
      !layers.points ||
      pointLayerOpacity <= 0 ||
      renderedPoints.length === 0
    ) {
      return null;
    }

    const transform = canvasTransform(
      { height: rect.height, width: rect.width },
      spanX,
      spanY,
    );
    const world = unprojectScreenPoint({
      bbox,
      transform,
      x: clientX - rect.left,
      y: clientY - rect.top,
    });
    const thresholdWorld = 13 / transform.scale;
    let closest: AtlasPoint | null = null;
    let closestDistanceSq = thresholdWorld * thresholdWorld;

    for (const point of renderedPoints) {
      const dx = point.x - world.x;
      const dy = point.y - world.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq < closestDistanceSq) {
        closest = point;
        closestDistanceSq = distanceSq;
      }
    }

    return closest;
  }

  function isClusterEventTarget(target: EventTarget | null): boolean {
    return (
      target instanceof Element &&
      Boolean(target.closest('[data-atlas-kind="cluster"], [data-atlas-kind="cluster-hit"]'))
    );
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    const pointerX = rect ? event.clientX - rect.left : null;
    const pointerY = rect ? event.clientY - rect.top : null;

    setViewport((current) => ({
      ...current,
      ...(() => {
        const nextZoom = clampAtlasZoom(
          current.zoom - event.deltaY * ATLAS_VISUAL_CONFIG.zoom.wheelSensitivity,
        );

        if (
          !rect ||
          pointerX === null ||
          pointerY === null ||
          nextZoom === current.zoom
        ) {
          return { zoom: nextZoom };
        }

        const currentBbox = {
          minX: current.centerX - spanX / 2,
          maxX: current.centerX + spanX / 2,
          minY: current.centerY - spanY / 2,
          maxY: current.centerY + spanY / 2,
        };
        const currentTransform = canvasTransform(
          { height: rect.height, width: rect.width },
          spanX,
          spanY,
        );
        const pointerWorld = unprojectScreenPoint({
          bbox: currentBbox,
          transform: currentTransform,
          x: pointerX,
          y: pointerY,
        });
        const nextSpan = viewSpanForWorldBounds(nextZoom, worldBounds);
        const nextTransform = canvasTransform(
          { height: rect.height, width: rect.width },
          nextSpan.spanX,
          nextSpan.spanY,
        );
        const nextMinX =
          pointerWorld.x - (pointerX - nextTransform.offsetX) / nextTransform.scale;
        const nextMinY =
          pointerWorld.y - (pointerY - nextTransform.offsetY) / nextTransform.scale;

        return {
          centerX: Number((nextMinX + nextSpan.spanX / 2).toFixed(4)),
          centerY: Number((nextMinY + nextSpan.spanY / 2).toFixed(4)),
          zoom: nextZoom,
        };
      })(),
    }));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    onHoverPoint(null);
    dragRef.current = {
      centerX: viewport.centerX,
      centerY: viewport.centerY,
      clientX: event.clientX,
      clientY: event.clientY,
      moved: false,
      spanX,
      spanY,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (drag) {
      const dx = ((event.clientX - drag.clientX) / rect.width) * drag.spanX;
      const dy = ((event.clientY - drag.clientY) / rect.height) * drag.spanY;
      if (Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY) > 3) {
        drag.moved = true;
      }
      setViewport((current) => ({
        ...current,
        centerX: Number((drag.centerX - dx).toFixed(4)),
        centerY: Number((drag.centerY - dy).toFixed(4)),
      }));
      return;
    }

    if (isClusterEventTarget(event.target)) {
      return;
    }

    const nearest = nearestCanvasPoint(event.clientX, event.clientY);
    if (nearest) {
      onHoverCluster(null);
      onHoverPoint(nearest);
    } else {
      onHoverPoint(null);
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;

    if (!drag || drag.moved || isClusterEventTarget(event.target)) return;

    const nearest = nearestCanvasPoint(event.clientX, event.clientY);
    if (nearest) {
      onSelectPoint(nearest);
      onHoverPoint(nearest);
    }
  }

  // Roving tabindex: the cluster layer is a single tab stop. Arrow keys move
  // focus between clusters (and stop propagating so they don't also pan the
  // map); Escape returns focus to the surface, where arrows pan again.
  function focusClusterAt(nextIndex: number) {
    if (clusters.length === 0) {
      return;
    }
    const wrapped =
      ((nextIndex % clusters.length) + clusters.length) % clusters.length;
    setActiveClusterIndex(wrapped);
    clusterHitRefs.current[wrapped]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const panKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"] as const;
    const isPan = panKeys.includes(event.key as (typeof panKeys)[number]);
    const isZoomIn = event.key === "+" || event.key === "=";
    const isZoomOut = event.key === "-";

    if (!isPan && !isZoomIn && !isZoomOut) {
      return;
    }

    event.preventDefault();

    if (isPan) {
      const panStepX = spanX * 0.08;
      const panStepY = spanY * 0.08;
      setViewport((current) => ({
        ...current,
        centerX: Number(
          (
            current.centerX +
            (event.key === "ArrowRight"
              ? panStepX
              : event.key === "ArrowLeft"
                ? -panStepX
                : 0)
          ).toFixed(4),
        ),
        centerY: Number(
          (
            current.centerY +
            (event.key === "ArrowDown"
              ? panStepY
              : event.key === "ArrowUp"
                ? -panStepY
                : 0)
          ).toFixed(4),
        ),
      }));
      return;
    }

    setViewport((current) => ({
      ...current,
      zoom: clampAtlasZoom(current.zoom + (isZoomIn ? 0.35 : -0.35)),
    }));
  }

  return (
    <div
      ref={containerRef}
      aria-label={mapAriaLabel}
      className="absolute inset-0 overflow-hidden"
      data-testid="atlas-canvas"
      onBlur={() => setSurfaceFocused(false)}
      onFocus={() => setSurfaceFocused(true)}
      onKeyDown={handleKeyDown}
      onPointerCancel={handlePointerUp}
      onPointerDown={handlePointerDown}
      onPointerLeave={() => {
        if (!dragRef.current) onHoverPoint(null);
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      role="application"
      style={interactiveRootStyle}
      tabIndex={0}
    >
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.62),transparent_42%)]"
        style={CANVAS_GLOW_STYLE}
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
        data-atlas-density-stipple-count={densityStipple.length}
        data-atlas-layer="canvas-map-texture"
        data-atlas-point-context-count={pointContextStipple.length}
        data-atlas-point-count={renderedPoints.length}
        data-testid="atlas-map-canvas"
        style={CANVAS_TEXTURE_STYLE}
      />
      <svg
        className="absolute inset-0 z-[3] h-full w-full cursor-grab touch-none active:cursor-grabbing"
        data-testid="atlas-overlay"
        preserveAspectRatio="xMidYMid slice"
        style={CANVAS_SVG_STYLE}
        viewBox={`${bbox.minX} ${bbox.minY} ${spanX} ${spanY}`}
      >
        <defs>
          <filter id="atlas-target-soft" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
          <filter id="atlas-region-soft" x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur stdDeviation="0.7" />
          </filter>
          <filter id="atlas-label-soft" x="-35%" y="-35%" width="170%" height="170%">
            <feDropShadow
              dx="0"
              dy="1"
              floodColor="rgba(32, 39, 43, 0.68)"
              floodOpacity="1"
              stdDeviation="1.35"
            />
            <feDropShadow
              dx="0"
              dy="0"
              floodColor="rgba(32, 39, 43, 0.46)"
              floodOpacity="1"
              stdDeviation="2.4"
            />
          </filter>
        </defs>

        {densityRegions.length > 0 && densityLayerOpacity > 0 ? (
          <g
            data-atlas-layer="semantic-regions"
            opacity={Math.min(1, densityLayerOpacity + clusterLayerOpacity * 0.28)}
          >
            {densityRegions.map((region) => (
              <g key={region.id} data-atlas-kind="density-region">
                <path
                  d={`${pathToD(region.outerPath)} Z`}
                  fill="none"
                  filter="url(#atlas-region-soft)"
                  stroke={rgbaCssFromHex(
                    region.colorKey,
                    ATLAS_VISUAL_CONFIG.regions.outerStrokeAlpha,
                    palette,
                  )}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={`${pathToD(region.path)} Z`}
                  fill={rgbaCssFromHex(
                    region.colorKey,
                    ATLAS_VISUAL_CONFIG.regions.fillAlpha,
                    palette,
                  )}
                  stroke={rgbaCssFromHex(
                    region.colorKey,
                    ATLAS_VISUAL_CONFIG.regions.strokeAlpha,
                    palette,
                  )}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.15}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ))}
          </g>
        ) : null}

        {layers.boundaries && contourPaths.length > 0 ? (
          <g
            data-atlas-layer="contours"
            opacity={layerOpacities.contours}
          >
            {contourPaths.map((contour) => (
              <path
                key={contour.id}
                d={`${pathToD(contour.path)} Z`}
                data-atlas-cluster-id={contour.clusterId}
                data-atlas-kind="contour"
                fill="none"
                stroke={contour.color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={contour.width}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        ) : null}

        {branchPaths.length > 0 && branchLayerOpacity > 0 ? (
          <g
            data-atlas-layer="branches"
            opacity={branchLayerOpacity}
            pointerEvents="none"
          >
            {branchPaths.map((branch) => (
              <path
                key={`${branch.clusterId}-${branch.entityId}`}
                d={branch.d}
                data-atlas-cluster-id={branch.clusterId}
                data-atlas-entity-id={branch.entityId}
                data-atlas-kind="branch"
                fill="none"
                stroke={rgbaCssFromHex(
                  branch.colorKey,
                  ATLAS_VISUAL_CONFIG.branches.alpha *
                    (0.55 + branch.importance * 0.45),
                  palette,
                )}
                strokeLinecap="round"
                strokeWidth={ATLAS_VISUAL_CONFIG.branches.widthPx}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        ) : null}

        {clusters.length > 0 && clusterLayerOpacity > 0 ? (
          <g data-atlas-layer="clusters" opacity={clusterLayerOpacity}>
            {clusters.map((cluster) => {
              const hovered = hoveredClusterId === cluster.clusterId;
              const style = getClusterVisualStyle(cluster, pixelWorld, hovered, palette);
              return (
                <g
                  key={cluster.id}
                  aria-hidden="true"
                  data-atlas-cluster-id={cluster.clusterId}
                  data-atlas-kind="cluster"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectCluster(cluster);
                  }}
                  onMouseEnter={() => {
                    setHoveredClusterId(cluster.clusterId);
                    onHoverPoint(null);
                    onHoverCluster(cluster);
                  }}
                  onMouseLeave={() => {
                    setHoveredClusterId(null);
                    onHoverCluster(null);
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <circle
                    cx={cluster.centroidX}
                    cy={cluster.centroidY}
                    data-atlas-kind="cluster-halo"
                    fill={style.haloColor}
                    pointerEvents="none"
                    r={style.haloRadius}
                  />
                  <circle
                    cx={cluster.centroidX}
                    cy={cluster.centroidY}
                    data-atlas-kind="cluster-bubble"
                    fill={style.fillColor}
                    r={style.radius}
                    stroke={style.strokeColor}
                    strokeWidth={style.strokeWidth}
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle
                    cx={cluster.centroidX}
                    cy={cluster.centroidY}
                    data-atlas-kind="cluster-center"
                    fill={style.centerColor}
                    pointerEvents="none"
                    r={style.centerRadius}
                  />
                </g>
              );
            })}
          </g>
        ) : null}

        {lod !== "points" && clusters.length > 0 && clusterLayerOpacity > 0 ? (
          <g data-atlas-layer="cluster-hit-targets">
            {clusters.map((cluster, index) => {
              const style = getClusterVisualStyle(cluster, pixelWorld, false, palette);
              const isRovingTarget =
                index === Math.min(activeClusterIndex, clusters.length - 1);
              return (
                <circle
                  key={`${cluster.id}-hit`}
                  ref={(el) => {
                    clusterHitRefs.current[index] = el;
                  }}
                  aria-label={clusterSelectLabel(cluster)}
                  cx={cluster.centroidX}
                  cy={cluster.centroidY}
                  data-atlas-cluster-id={cluster.clusterId}
                  data-atlas-kind="cluster-hit"
                  fill="rgba(15, 23, 42, 0.001)"
                  pointerEvents="all"
                  role="button"
                  r={style.radius}
                  stroke="transparent"
                  tabIndex={isRovingTarget ? 0 : -1}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectCluster(cluster);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      onSelectCluster(cluster);
                      return;
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      containerRef.current?.focus();
                      return;
                    }
                    if (event.key === "Home") {
                      event.preventDefault();
                      event.stopPropagation();
                      focusClusterAt(0);
                      return;
                    }
                    if (event.key === "End") {
                      event.preventDefault();
                      event.stopPropagation();
                      focusClusterAt(clusters.length - 1);
                      return;
                    }
                    const step =
                      event.key === "ArrowRight" || event.key === "ArrowDown"
                        ? 1
                        : event.key === "ArrowLeft" || event.key === "ArrowUp"
                          ? -1
                          : 0;
                    if (step === 0) {
                      return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    focusClusterAt(index + step);
                  }}
                  onMouseEnter={() => {
                    setHoveredClusterId(cluster.clusterId);
                    onHoverPoint(null);
                    onHoverCluster(cluster);
                  }}
                  onMouseLeave={() => {
                    setHoveredClusterId(null);
                    onHoverCluster(null);
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                />
              );
            })}
          </g>
        ) : null}

        {targetMarker ? (
          <g
            key={targetMarker.id}
            className="atlas-target-marker"
            data-atlas-kind="target-marker"
            pointerEvents="none"
          >
            <circle
              className="atlas-target-marker-ring"
              cx={targetMarker.x}
              cy={targetMarker.y}
              fill="none"
              r={pixelWorld * 30}
              stroke="rgba(37, 99, 235, 0.52)"
              strokeWidth={2.3}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={targetMarker.x}
              cy={targetMarker.y}
              fill="rgba(37, 99, 235, 0.72)"
              filter="url(#atlas-target-soft)"
              r={pixelWorld * 5.5}
            />
          </g>
        ) : null}

        {layers.labels && densityLayerOpacity > 0
          ? densityLabels.map((label) => {
              const displayLabel = mapLabel(label.label, 30);
              return (
              <g
                key={label.id}
                data-atlas-kind="density-label"
                opacity={densityLayerOpacity}
                pointerEvents="none"
              >
                <text
                dominantBaseline="middle"
                fill="rgba(245, 247, 247, 0.98)"
                filter="url(#atlas-label-soft)"
                fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont"
                fontSize={densityLabelSize}
                fontWeight={650}
                paintOrder="stroke"
                stroke={palette.labelHalo}
                strokeWidth={densityLabelSize * 0.18}
                textAnchor="middle"
                x={label.x}
                y={label.y}
              >
                  {displayLabel}
              </text>
              </g>
              );
            })
          : null}

        {layers.labels && clusterLayerOpacity > 0
          ? clusterLabels.map((cluster) => {
              const displayLabel = mapLabel(cluster.label, 32);
              return (
              <g
                key={`${cluster.id}-label`}
                data-atlas-cluster-id={cluster.clusterId}
                data-atlas-kind="cluster-label"
                opacity={Math.min(1, clusterLayerOpacity + 0.18)}
                pointerEvents="none"
              >
                <text
                dominantBaseline="middle"
                fill="rgba(245, 247, 247, 0.98)"
                filter="url(#atlas-label-soft)"
                fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont"
                fontSize={clusterLabelSize}
                fontWeight={650}
                paintOrder="stroke"
                stroke={palette.labelHalo}
                strokeWidth={clusterLabelSize * 0.18}
                textAnchor="middle"
                x={cluster.centroidX}
                y={cluster.centroidY}
              >
                  {displayLabel}
              </text>
              </g>
              );
            })
          : null}
      </svg>

      <div
        className="pointer-events-none absolute inset-0 z-[3] opacity-[0.07]"
        style={CANVAS_GRID_OVERLAY_STYLE}
      >
        <svg
          aria-hidden="true"
          className="h-full w-full"
          style={CANVAS_GRID_SVG_STYLE}
        >
          <defs>
            <pattern id="atlas-grid" height="64" width="64" patternUnits="userSpaceOnUse">
              <path d="M 64 0 L 0 0 0 64" fill="none" stroke="#d6d3ca" strokeWidth="0.7" />
            </pattern>
          </defs>
          <rect fill="url(#atlas-grid)" height="100%" width="100%" />
        </svg>
      </div>
    </div>
  );
}
