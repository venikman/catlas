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
import { ATLAS_LOD_CONFIG } from "@/lib/atlas/lod";
import {
  densityTilesToSamples,
  hexToRgba,
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
import type { AtlasViewportState, LayerToggles } from "./AtlasViewer";

type AtlasCanvasProps = {
  bbox: AtlasBbox;
  clusters: AtlasCluster[];
  densityTiles: AtlasDensityTile[];
  layers: LayerToggles;
  lod: AtlasLodLayer;
  onHoverPoint: (point: AtlasPoint | null) => void;
  onSelectPoint: (point: AtlasPoint) => void;
  points: AtlasPoint[];
  selectedEntityId: string | null;
  setViewport: Dispatch<SetStateAction<AtlasViewportState>>;
  viewport: AtlasViewportState;
};

type AtlasContourPath = {
  color: [number, number, number, number];
  id: string;
  path: [number, number, number][];
  width: number;
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

function buildClusterContours(clusters: AtlasCluster[]): AtlasContourPath[] {
  const paths: AtlasContourPath[] = [];

  for (const cluster of clusters) {
    const seed = hashString(cluster.id);
    const phase = (seed % 628) / 100;
    const baseRadius = Math.max(0.42, Math.min(1.28, cluster.radius * 0.52));
    const xBias = 0.92 + ((seed % 9) - 4) * 0.018;
    const yBias = 0.74 + (((seed >> 3) % 9) - 4) * 0.018;

    for (let ring = 0; ring < 4; ring += 1) {
      const scale = 0.72 + ring * 0.22;
      const path: [number, number, number][] = [];

      for (let index = 0; index <= 88; index += 1) {
        const theta = (index / 88) * Math.PI * 2;
        const wobble =
          1 +
          Math.sin(theta * 3 + phase) * 0.08 +
          Math.sin(theta * 7 + phase * 0.7) * 0.045;
        const rx = baseRadius * scale * wobble * xBias;
        const ry = baseRadius * scale * wobble * yBias;
        path.push([
          cluster.centroidX + Math.cos(theta) * rx,
          cluster.centroidY + Math.sin(theta) * ry,
          0,
        ]);
      }

      paths.push({
        color: hexToRgba(
          cluster.colorKey,
          ring === 0 ? 48 : ring === 1 ? 32 : ring === 2 ? 20 : 12,
        ),
        id: `${cluster.id}-contour-${ring}`,
        path,
        width: ring === 0 ? 1 : 0.65,
      });
    }
  }

  return paths;
}

function styledPointForLod(
  point: RenderedAtlasPoint,
  lod: AtlasLodLayer,
  selectedEntityId: string | null,
): RenderedAtlasPoint {
  const defaultRadius = 3 + point.importance * 5;
  const transitionScale = point.renderRadius
    ? point.renderRadius / defaultRadius
    : 1;
  const opacityScale = point.renderOpacity ?? 1;

  const radius =
    lod === "clusters"
      ? 0.8 + point.importance * 1.35
      : lod === "density"
        ? 1 + point.importance * 1.4
        : 2.2 + point.importance * 3.9;
  const opacity =
    lod === "clusters" ? 0.34 : lod === "density" ? 0.34 : 0.82;

  return {
    ...point,
    renderOpacity: opacity * opacityScale,
    renderRadius:
      point.entityId === selectedEntityId
        ? lod === "points"
          ? 8
          : 5
        : radius * transitionScale,
  };
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
        (now - startedAt) / ATLAS_LOD_CONFIG.viewTransitionMs,
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

function rgbaCss(color: [number, number, number, number]): string {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${(color[3] / 255).toFixed(3)})`;
}

function pathToD(path: [number, number, number][]): string {
  return path
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(4)} ${y.toFixed(4)}`)
    .join(" ");
}

function clampZoom(zoom: number): number {
  return Math.min(9.5, Math.max(-1.5, Number(zoom.toFixed(2))));
}

export function AtlasCanvas({
  bbox,
  clusters,
  densityTiles,
  layers,
  lod,
  onHoverPoint,
  onSelectPoint,
  points,
  selectedEntityId,
  setViewport,
  viewport,
}: AtlasCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const renderedPoints = useInterpolatedPoints(points);
  const styledPoints = useMemo(
    () =>
      renderedPoints.map((point) =>
        styledPointForLod(point, lod, selectedEntityId),
      ),
    [lod, renderedPoints, selectedEntityId],
  );
  const densitySamples = useMemo(
    () => densityTilesToSamples(densityTiles),
    [densityTiles],
  );
  const contourPaths = useMemo(() => buildClusterContours(clusters), [clusters]);
  const labels = useMemo(
    () =>
      clusters
        .slice()
        .sort((a, b) => b.pointCount - a.pointCount)
        .slice(0, lod === "points" ? 24 : 18),
    [clusters, lod],
  );

  const spanX = bbox.maxX - bbox.minX;
  const spanY = bbox.maxY - bbox.minY;
  const pixelWorld = spanX / 980;
  const labelSize = Math.max(0.044, Math.min(0.074, pixelWorld * 12));

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    setViewport((current) => ({
      ...current,
      zoom: clampZoom(current.zoom - event.deltaY * 0.004),
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
      onPointerCancel={handlePointerUp}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    >
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_45%_40%,rgba(37,99,235,0.04),transparent_28%),radial-gradient(circle_at_72%_70%,rgba(245,158,11,0.045),transparent_26%)]" />
      <svg
        aria-label="Semantic atlas map"
        className="absolute inset-0 z-[2] h-full w-full cursor-grab touch-none active:cursor-grabbing"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        viewBox={`${bbox.minX} ${bbox.minY} ${spanX} ${spanY}`}
      >
        {layers.density && lod === "density"
          ? densitySamples.map((sample: DensitySample) => (
              <circle
                key={sample.id}
                cx={sample.x}
                cy={sample.y}
                fill={rgbaCss(hexToRgba(sample.colorKey, 28))}
                r={Math.max(0.12, Math.min(0.52, 0.16 + sample.weight * 0.42))}
              />
            ))
          : null}

        {layers.clusters
          ? clusters.map((cluster) => (
              <circle
                key={cluster.id}
                cx={cluster.centroidX}
                cy={cluster.centroidY}
                fill={rgbaCss(hexToRgba(cluster.colorKey, 12))}
                r={Math.max(0.2, Math.min(0.72, cluster.radius * 0.32))}
                stroke={rgbaCss(hexToRgba(cluster.colorKey, 32))}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))
          : null}

        {layers.boundaries
          ? contourPaths.map((contour) => (
              <path
                key={contour.id}
                d={`${pathToD(contour.path)} Z`}
                fill="none"
                stroke={rgbaCss(contour.color)}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={contour.width}
                vectorEffect="non-scaling-stroke"
              />
            ))
          : null}

        {(layers.points || lod === "points" || lod === "clusters")
          ? styledPoints.map((point) => {
              const radius = pixelWorld * (point.renderRadius ?? 2.2);
              const selected = point.entityId === selectedEntityId;
              return (
                <circle
                  key={`${point.id}-${point.viewId}`}
                  cx={point.x}
                  cy={point.y}
                  fill={rgbaCss(
                    hexToRgba(
                      point.colorKey,
                      Math.round(235 * (point.renderOpacity ?? 1)),
                    ),
                  )}
                  r={selected ? pixelWorld * 8 : radius}
                  stroke={selected ? "rgba(15, 23, 42, 0.72)" : "transparent"}
                  strokeWidth={selected ? 2 : 0}
                  vectorEffect="non-scaling-stroke"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectPoint(point);
                  }}
                  onMouseEnter={() => onHoverPoint(point)}
                  onMouseLeave={() => onHoverPoint(null)}
                />
              );
            })
          : null}

        {layers.labels
          ? labels.map((cluster) => (
              <text
                key={`${cluster.id}-label`}
                dominantBaseline="middle"
                fill="rgba(15, 23, 42, 0.92)"
                fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont"
                fontSize={labelSize}
                fontWeight={700}
                paintOrder="stroke"
                stroke="rgba(255, 255, 255, 0.92)"
                strokeWidth={labelSize * 0.42}
                textAnchor="middle"
                x={cluster.centroidX}
                y={cluster.centroidY}
              >
                {cluster.label}
              </text>
            ))
          : null}
      </svg>

      <div className="pointer-events-none absolute inset-0 z-[3] opacity-45">
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
