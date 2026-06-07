"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent,
  type SetStateAction,
  type WheelEvent,
} from "react";
import {
  densityTilesToSamples,
  type DensitySample,
  type RenderedAtlasPoint,
} from "@/lib/atlas/rendering/buffers";
import { interpolatePointSet } from "@/lib/atlas/rendering/transitions";
import type {
  AtlasBbox,
  AtlasCluster,
  AtlasDensityTile,
  AtlasLodLayer,
  AtlasPoint,
} from "@/lib/atlas/types";
import {
  ATLAS_VISUAL_CONFIG,
  clampAtlasZoom,
  getClusterVisualStyle,
  getContourVisualStyle,
  getDensityVisualStyle,
  getLodBlend,
  getPointVisualStyle,
  labelFontSize,
  rgbaCssFromHex,
  selectClusterLabels,
  selectDensityLabels,
} from "@/lib/atlas/visualConfig";
import type { AtlasViewportState, LayerToggles } from "./AtlasViewer";

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
  points: AtlasPoint[];
  selectedEntityId: string | null;
  setViewport: Dispatch<SetStateAction<AtlasViewportState>>;
  targetMarker: AtlasTargetMarker | null;
  viewport: AtlasViewportState;
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

type DragState = {
  centerX: number;
  centerY: number;
  clientX: number;
  clientY: number;
  spanX: number;
  spanY: number;
};

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 9973;
  }
  return hash;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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

function mapLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 3)}...`;
}

function labelChipMetrics(
  label: string,
  fontSize: number,
  pixelWorld: number,
): { height: number; radius: number; width: number } {
  const paddingX = pixelWorld * 13;
  const width = clampNumber(
    label.length * fontSize * 0.56 + paddingX * 2,
    pixelWorld * 70,
    pixelWorld * 250,
  );
  return {
    height: fontSize * 1.9,
    radius: pixelWorld * 6,
    width,
  };
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
  points,
  selectedEntityId,
  setViewport,
  targetMarker,
  viewport,
}: AtlasCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [hoveredClusterId, setHoveredClusterId] = useState<string | null>(null);
  const renderedPoints = useInterpolatedPoints(points);

  const densitySamples = useMemo(
    () => densityTilesToSamples(densityTiles),
    [densityTiles],
  );

  const spanX = bbox.maxX - bbox.minX;
  const spanY = bbox.maxY - bbox.minY;
  const pixelWorld = Math.max(spanX / 980, spanY / 720);
  const densityRegions = useMemo(
    () => buildDensityRegions(densitySamples, pixelWorld),
    [densitySamples, pixelWorld],
  );
  const contourPaths = useMemo(() => buildClusterContours(clusters), [clusters]);
  const lodBlend = useMemo(() => getLodBlend(viewport.zoom), [viewport.zoom]);
  const densityLayerOpacity = layers.density ? lodBlend.density : 0;
  const clusterLayerOpacity = layers.clusters ? lodBlend.clusters : 0;
  const pointLayerOpacity =
    lod === "points" ? lodBlend.points : lod === "clusters" ? lodBlend.clusters : 0;
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

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    setViewport((current) => ({
      ...current,
      zoom: clampAtlasZoom(
        current.zoom - event.deltaY * ATLAS_VISUAL_CONFIG.zoom.wheelSensitivity,
      ),
    }));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      centerX: viewport.centerX,
      centerY: viewport.centerY,
      clientX: event.clientX,
      clientY: event.clientY,
      spanX,
      spanY,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!drag || !rect) return;

    const dx = ((event.clientX - drag.clientX) / rect.width) * drag.spanX;
    const dy = ((event.clientY - drag.clientY) / rect.height) * drag.spanY;
    setViewport((current) => ({
      ...current,
      centerX: Number((drag.centerX - dx).toFixed(4)),
      centerY: Number((drag.centerY - dy).toFixed(4)),
    }));
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden bg-[#f8f6f0]"
      data-testid="atlas-canvas"
      onPointerCancel={handlePointerUp}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    >
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_42%_38%,rgba(37,99,235,0.045),transparent_28%),radial-gradient(circle_at_72%_70%,rgba(245,158,11,0.05),transparent_26%)]" />
      <svg
        aria-label="Semantic atlas map"
        className="absolute inset-0 z-[2] h-full w-full cursor-grab touch-none active:cursor-grabbing"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        viewBox={`${bbox.minX} ${bbox.minY} ${spanX} ${spanY}`}
      >
        <defs>
          <filter id="atlas-target-soft" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
          <filter id="atlas-region-soft" x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur stdDeviation="0.7" />
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
                  )}
                  stroke={rgbaCssFromHex(
                    region.colorKey,
                    ATLAS_VISUAL_CONFIG.regions.strokeAlpha,
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

        {densitySamples.length > 0 && densityLayerOpacity > 0 ? (
          <g data-atlas-layer="density" opacity={densityLayerOpacity}>
            {densitySamples.map((sample: DensitySample) => {
              const style = getDensityVisualStyle(sample, pixelWorld);
              return (
                <circle
                  key={`${sample.id}-halo`}
                  cx={sample.x}
                  cy={sample.y}
                  data-atlas-kind="density-halo"
                  fill={style.haloColor}
                  r={style.haloRadius}
                />
              );
            })}
            {densitySamples.map((sample: DensitySample) => {
              const style = getDensityVisualStyle(sample, pixelWorld);
              return (
                <circle
                  key={`${sample.id}-core`}
                  cx={sample.x}
                  cy={sample.y}
                  data-atlas-kind="density-core"
                  fill={style.coreColor}
                  r={style.coreRadius}
                />
              );
            })}
          </g>
        ) : null}

        {layers.boundaries && contourPaths.length > 0 ? (
          <g
            data-atlas-layer="contours"
            opacity={Math.max(densityLayerOpacity * 0.82, clusterLayerOpacity)}
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

        {clusters.length > 0 && clusterLayerOpacity > 0 ? (
          <g data-atlas-layer="clusters" opacity={clusterLayerOpacity}>
            {clusters.map((cluster) => {
              const hovered = hoveredClusterId === cluster.clusterId;
              const style = getClusterVisualStyle(cluster, pixelWorld, hovered);
              return (
                <g
                  key={cluster.id}
                  data-atlas-cluster-id={cluster.clusterId}
                  data-atlas-kind="cluster"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectCluster(cluster);
                  }}
                  onMouseEnter={() => {
                    setHoveredClusterId(cluster.clusterId);
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

        {renderedPoints.length > 0 && pointLayerOpacity > 0 ? (
          <g data-atlas-layer="points" opacity={Math.max(0.2, pointLayerOpacity)}>
            {renderedPoints.map((point) => {
              const selected = point.entityId === selectedEntityId;
              const hovered = point.entityId === hoveredEntityId;
              const style = getPointVisualStyle({
                colorKey: point.colorKey,
                hovered,
                importance: point.importance,
                lod,
                pixelWorld,
                selected,
                transitionOpacity: point.renderOpacity ?? 1,
              });

              return (
                <g key={`${point.id}-${point.viewId}`} data-atlas-kind="point-group">
                  {style.haloOpacity > 0 ? (
                    <circle
                      cx={point.x}
                      cy={point.y}
                      data-atlas-entity-id={point.entityId}
                      data-atlas-kind={selected ? "selected-halo" : "hover-halo"}
                      fill={rgbaCssFromHex(point.colorKey, style.haloOpacity)}
                      r={style.haloRadius}
                    />
                  ) : null}
                  {selected ? (
                    <circle
                      cx={point.x}
                      cy={point.y}
                      data-atlas-entity-id={point.entityId}
                      data-atlas-kind="selected-ring"
                      fill="none"
                      r={style.radius * 2.1}
                      stroke={rgbaCssFromHex(point.colorKey, 0.34)}
                      strokeWidth={1.2}
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    data-atlas-entity-id={point.entityId}
                    data-atlas-kind="point"
                    fill={style.fillColor}
                    r={style.radius}
                    stroke={style.strokeColor}
                    strokeWidth={style.strokeWidth}
                    vectorEffect="non-scaling-stroke"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectPoint(point);
                    }}
                    onMouseEnter={() => {
                      onHoverCluster(null);
                      onHoverPoint(point);
                    }}
                    onMouseLeave={() => onHoverPoint(null)}
                    onPointerDown={(event) => event.stopPropagation()}
                  />
                </g>
              );
            })}
          </g>
        ) : null}

        {lod !== "points" && clusters.length > 0 && clusterLayerOpacity > 0 ? (
          <g data-atlas-layer="cluster-hit-targets">
            {clusters.map((cluster) => {
              const style = getClusterVisualStyle(cluster, pixelWorld, false);
              return (
                <circle
                  key={`${cluster.id}-hit`}
                  cx={cluster.centroidX}
                  cy={cluster.centroidY}
                  data-atlas-cluster-id={cluster.clusterId}
                  data-atlas-kind="cluster-hit"
                  fill="rgba(15, 23, 42, 0.001)"
                  pointerEvents="all"
                  r={style.radius}
                  stroke="transparent"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectCluster(cluster);
                  }}
                  onMouseEnter={() => {
                    setHoveredClusterId(cluster.clusterId);
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
              const chip = labelChipMetrics(displayLabel, densityLabelSize, pixelWorld);
              return (
              <g
                key={label.id}
                data-atlas-kind="density-label"
                opacity={densityLayerOpacity}
                pointerEvents="none"
              >
                <rect
                  fill="rgba(255, 254, 250, 0.72)"
                  height={chip.height}
                  rx={chip.radius}
                  stroke={rgbaCssFromHex(label.colorKey, 0.2)}
                  strokeWidth={0.8}
                  vectorEffect="non-scaling-stroke"
                  width={chip.width}
                  x={label.x - chip.width / 2}
                  y={label.y - chip.height / 2}
                />
                <text
                dominantBaseline="middle"
                fill="rgba(15, 23, 42, 0.74)"
                fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont"
                fontSize={densityLabelSize}
                fontWeight={700}
                paintOrder="stroke"
                stroke="rgba(255, 255, 255, 0.9)"
                strokeWidth={densityLabelSize * 0.42}
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
              const chip = labelChipMetrics(displayLabel, clusterLabelSize, pixelWorld);
              return (
              <g
                key={`${cluster.id}-label`}
                data-atlas-cluster-id={cluster.clusterId}
                data-atlas-kind="cluster-label"
                opacity={Math.min(1, clusterLayerOpacity + 0.18)}
                pointerEvents="none"
              >
                <rect
                  fill="rgba(255, 254, 250, 0.8)"
                  height={chip.height}
                  rx={chip.radius}
                  stroke={rgbaCssFromHex(cluster.colorKey, 0.24)}
                  strokeWidth={0.85}
                  vectorEffect="non-scaling-stroke"
                  width={chip.width}
                  x={cluster.centroidX - chip.width / 2}
                  y={cluster.centroidY - chip.height / 2}
                />
                <text
                dominantBaseline="middle"
                fill="rgba(15, 23, 42, 0.86)"
                fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont"
                fontSize={clusterLabelSize}
                fontWeight={700}
                paintOrder="stroke"
                stroke="rgba(255, 255, 255, 0.92)"
                strokeWidth={clusterLabelSize * 0.42}
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

      <div className="pointer-events-none absolute inset-0 z-[3] opacity-35">
        <svg aria-hidden="true" className="h-full w-full">
          <defs>
            <pattern id="atlas-grid" height="64" width="64" patternUnits="userSpaceOnUse">
              <path d="M 64 0 L 0 0 0 64" fill="none" stroke="#d6d3ca" strokeWidth="0.7" />
            </pattern>
          </defs>
          <rect fill="url(#atlas-grid)" height="100%" width="100%" />
        </svg>
      </div>
      <div className="pointer-events-none absolute bottom-[172px] left-8 z-[4] hidden rounded-md border border-slate-200 bg-white/76 px-3 py-2 text-[11px] text-slate-600 shadow-sm backdrop-blur sm:block">
        <div className="font-semibold uppercase tracking-[0.12em] text-slate-500">Bbox</div>
        <div className="mt-2 grid grid-cols-[auto_auto_auto] gap-x-2 gap-y-1 font-mono">
          <span>X</span>
          <span>{bbox.minX.toFixed(3)}</span>
          <span>to {bbox.maxX.toFixed(3)}</span>
          <span>Y</span>
          <span>{bbox.minY.toFixed(3)}</span>
          <span>to {bbox.maxY.toFixed(3)}</span>
        </div>
      </div>
    </div>
  );
}
