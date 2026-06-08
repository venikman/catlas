"use client";

import { atlasZoomToDisplayZoom } from "@/lib/atlas/visualConfig";
import { AtlasIcon } from "./AtlasIcon";

export function AtlasControls({
  onFit,
  onZoomStep,
  zoom,
}: {
  onFit: () => void;
  onZoomStep: (delta: number) => void;
  zoom: number;
}) {
  const displayZoom = atlasZoomToDisplayZoom(zoom);

  return (
    <div className="map-controls" aria-label="Map controls">
      <output aria-label="Zoom level" className="tabular">
        {displayZoom.toFixed(1)}x
      </output>
      <button
        type="button"
        aria-label="Zoom in"
        data-atlas-action="zoom-in"
        data-atlas-kind="map-control"
        onClick={() => onZoomStep(0.45)}
      >
        <AtlasIcon name="plus" />
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        data-atlas-action="zoom-out"
        data-atlas-kind="map-control"
        onClick={() => onZoomStep(-0.45)}
      >
        <AtlasIcon name="minus" />
      </button>
      <button
        type="button"
        aria-label="Fit map"
        data-atlas-action="home"
        data-atlas-kind="map-control"
        onClick={onFit}
      >
        <AtlasIcon name="locate" />
      </button>
    </div>
  );
}
