import {
  ATLAS_DEFAULT_WORLD_BOUNDS,
  type AtlasWorldBounds,
} from "../../contract/atlasStore";
import type { AtlasBbox } from "../../lib/atlas/types";
import type { AtlasViewportState } from "./atlasComponentTypes";

/** Viewport aspect ratio (height : width). Fixed by the canvas — not a world ratio. */
export const ATLAS_VIEWPORT_ASPECT = 0.72;

/** Breathing-room margin tuned for the default 14-unit world width. */
export const ATLAS_DEFAULT_WORLD_MARGIN = 15 / 14;

export function viewSpanForWorldBounds(
  zoom: number,
  worldBounds: AtlasWorldBounds = ATLAS_DEFAULT_WORLD_BOUNDS,
): { spanX: number; spanY: number } {
  const worldWidth = worldBounds.maxX - worldBounds.minX;
  const spanX =
    (worldWidth * ATLAS_DEFAULT_WORLD_MARGIN) / Math.pow(1.32, zoom);
  const spanY = spanX * ATLAS_VIEWPORT_ASPECT;
  return { spanX, spanY };
}

export function bboxForViewport(
  viewport: AtlasViewportState,
  worldBounds: AtlasWorldBounds = ATLAS_DEFAULT_WORLD_BOUNDS,
): AtlasBbox {
  const { spanX, spanY } = viewSpanForWorldBounds(viewport.zoom, worldBounds);
  return {
    minX: Number((viewport.centerX - spanX / 2).toFixed(4)),
    maxX: Number((viewport.centerX + spanX / 2).toFixed(4)),
    minY: Number((viewport.centerY - spanY / 2).toFixed(4)),
    maxY: Number((viewport.centerY + spanY / 2).toFixed(4)),
  };
}
