"use client";

import type { AtlasLodLayer } from "@catlas/atlas-react";

const LOD_ZOOM_TARGETS: Record<AtlasLodLayer, number> = {
  density: 1.2,
  clusters: 4.2,
  points: 7.2,
};

export function AtlasLodControls({
  active,
  onZoomChange,
}: {
  active: AtlasLodLayer;
  onZoomChange: (zoom: number) => void;
}) {
  return (
    <div className="lod-controls" aria-label="LOD controls">
      {(["density", "clusters", "points"] as AtlasLodLayer[]).map((layer) => (
        <button
          key={layer}
          type="button"
          aria-pressed={active === layer}
          className={active === layer ? "active" : ""}
          data-atlas-kind="lod-button"
          data-atlas-lod={layer}
          onClick={() => onZoomChange(LOD_ZOOM_TARGETS[layer])}
        >
          {layer}
        </button>
      ))}
    </div>
  );
}
