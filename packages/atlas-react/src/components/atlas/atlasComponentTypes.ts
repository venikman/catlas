import type { AtlasViewportState as BaseAtlasViewportState } from "../../lib/atlas/componentTypes";

export type AtlasViewportState = BaseAtlasViewportState;

export type LayerToggles = {
  density: boolean;
  clusters: boolean;
  points: boolean;
  labels: boolean;
  boundaries: boolean;
  heat: boolean;
  links: boolean;
};

export const ATLAS_INITIAL_VIEWPORT: AtlasViewportState = {
  centerX: 0.67,
  centerY: -0.31,
  zoom: 0.45,
};

export const ATLAS_INITIAL_LAYERS: LayerToggles = {
  density: true,
  clusters: true,
  points: true,
  labels: true,
  boundaries: true,
  heat: false,
  links: true,
};
