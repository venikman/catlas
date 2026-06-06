"use client";

import type { AtlasBbox, AtlasLodLayer } from "@/lib/atlas/types";

export function AtlasDebugPanel({
  bbox,
  isFetching,
  lod,
  pointCount,
  requestCount,
  source,
  zoom,
}: {
  bbox: AtlasBbox;
  isFetching: boolean;
  lod: AtlasLodLayer;
  pointCount: number;
  requestCount: number;
  source: string;
  zoom: number;
}) {
  return (
    <div className="atlas-panel w-[216px] rounded-md px-3 py-3 text-[11px] text-slate-600">
      <div className="flex items-center justify-between">
        <span className="font-semibold uppercase tracking-[0.14em] text-slate-500">
          Runtime
        </span>
        <span className={isFetching ? "text-blue-600" : "text-emerald-600"}>
          {isFetching ? "Fetching" : "Settled"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono">
        <span>LOD</span>
        <span>{lod}</span>
        <span>Zoom</span>
        <span>{zoom.toFixed(2)}</span>
        <span>Rows</span>
        <span>{pointCount}</span>
        <span>Payload</span>
        <span>{requestCount}</span>
        <span>Source</span>
        <span>{source}</span>
        <span>Span</span>
        <span>{(bbox.maxX - bbox.minX).toFixed(2)}</span>
      </div>
    </div>
  );
}
