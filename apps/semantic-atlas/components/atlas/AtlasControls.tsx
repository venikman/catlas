"use client";

import { Home, Layers3, LocateFixed, Minus, Plus, Settings2 } from "lucide-react";

export function AtlasControls({
  onHome,
  onZoomStep,
}: {
  onHome: () => void;
  onZoomStep: (delta: number) => void;
}) {
  const disabledClass = "opacity-45 cursor-not-allowed";

  return (
    <div className="flex flex-col gap-2">
      <div className="atlas-panel grid rounded-md p-1">
        <button
          aria-label="Home"
          className="atlas-control grid h-9 w-9 place-items-center rounded-sm"
          data-atlas-action="home"
          data-atlas-kind="map-control"
          onClick={onHome}
        >
          <Home size={17} />
        </button>
        <button
          aria-label="Locate selected"
          className={`atlas-control mt-1 grid h-9 w-9 place-items-center rounded-sm ${disabledClass}`}
          data-atlas-action="locate-selected"
          data-atlas-kind="map-control"
          disabled
        >
          <LocateFixed size={17} />
        </button>
      </div>
      <div className="atlas-panel grid rounded-md p-1">
        <button
          aria-label="Zoom in"
          className="atlas-control grid h-9 w-9 place-items-center rounded-sm"
          data-atlas-action="zoom-in"
          data-atlas-kind="map-control"
          onClick={() => onZoomStep(0.45)}
        >
          <Plus size={17} />
        </button>
        <button
          aria-label="Zoom out"
          className="atlas-control mt-1 grid h-9 w-9 place-items-center rounded-sm"
          data-atlas-action="zoom-out"
          data-atlas-kind="map-control"
          onClick={() => onZoomStep(-0.45)}
        >
          <Minus size={17} />
        </button>
      </div>
      <div className="atlas-panel grid rounded-md p-1">
        <button
          aria-label="Layer stack"
          className={`atlas-control grid h-9 w-9 place-items-center rounded-sm ${disabledClass}`}
          data-atlas-action="layer-stack"
          data-atlas-kind="map-control"
          disabled
        >
          <Layers3 size={17} />
        </button>
        <button
          aria-label="Renderer settings"
          className={`atlas-control mt-1 grid h-9 w-9 place-items-center rounded-sm ${disabledClass}`}
          data-atlas-action="renderer-settings"
          data-atlas-kind="map-control"
          disabled
        >
          <Settings2 size={17} />
        </button>
      </div>
    </div>
  );
}
