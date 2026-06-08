"use client";

import type { AtlasBbox, AtlasLodLayer } from "@/lib/atlas/types";

export function AtlasDebugPanel({
  activeView,
  animationActive,
  bbox,
  clusterCount,
  densityTileCount,
  fetchedPointCount,
  frameMs,
  fps,
  isFetching,
  lastRequestMs,
  lod,
  pointCount,
  requestCount,
  serverTimingMs,
  source,
  truncated,
  zoom,
}: {
  activeView: string;
  animationActive: boolean;
  bbox: AtlasBbox;
  clusterCount: number;
  densityTileCount: number;
  fetchedPointCount: number;
  frameMs: number;
  fps: number;
  isFetching: boolean;
  lastRequestMs: number | null;
  lod: AtlasLodLayer;
  pointCount: number;
  requestCount: number;
  serverTimingMs: number | null;
  source: string;
  truncated: boolean;
  zoom: number;
}) {
  return (
    <div
      className="atlas-panel w-[260px] rounded-md px-3 py-3 text-[11px] text-slate-600"
      data-testid="atlas-debug-panel"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold uppercase tracking-[0.14em] text-slate-500">
          Runtime
        </span>
        <span className={isFetching ? "text-blue-600" : "text-emerald-600"}>
          {isFetching ? "Fetching" : "Settled"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono">
        <span>View</span>
        <span className="truncate">{activeView}</span>
        <span>LOD</span>
        <span data-testid="atlas-debug-active-lod">{lod}</span>
        <span>Zoom</span>
        <span>{zoom.toFixed(2)}</span>
        <span>Fetched</span>
        <span data-testid="atlas-debug-fetched-count">{fetchedPointCount}</span>
        <span>Rendered</span>
        <span data-testid="atlas-debug-rendered-count">{pointCount}</span>
        <span>Clusters</span>
        <span>{clusterCount}</span>
        <span>Density</span>
        <span>{densityTileCount}</span>
        <span>Requests</span>
        <span>{requestCount}</span>
        <span>Client ms</span>
        <span>{lastRequestMs === null ? "n/a" : lastRequestMs.toFixed(1)}</span>
        <span>Server ms</span>
        <span>{serverTimingMs === null ? "n/a" : serverTimingMs.toFixed(1)}</span>
        <span>Frame</span>
        <span>{frameMs.toFixed(1)} ms</span>
        <span>FPS</span>
        <span>{fps.toFixed(0)}</span>
        <span>Truncated</span>
        <span>{truncated ? "yes" : "no"}</span>
        <span>Animate</span>
        <span>{animationActive ? "yes" : "no"}</span>
        <span>Source</span>
        <span>{source}</span>
        <span>Span</span>
        <span>{(bbox.maxX - bbox.minX).toFixed(2)}</span>
      </div>
    </div>
  );
}
