import type { AtlasBbox, AtlasLodLayer } from "./types";

function formatCoordinate(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

export function bboxKey(bbox: AtlasBbox): string {
  return [
    formatCoordinate(bbox.minX),
    formatCoordinate(bbox.maxX),
    formatCoordinate(bbox.minY),
    formatCoordinate(bbox.maxY),
  ].join(":");
}

export const atlasQueryKeys = {
  views: () => ["atlas", "views"] as const,
  viewport: (input: {
    view: string;
    lod: AtlasLodLayer;
    zoomBand: string;
    bbox: AtlasBbox;
  }) =>
    [
      "atlas",
      "viewport",
      input.view,
      input.lod,
      input.zoomBand,
      bboxKey(input.bbox),
    ] as const,
  entity: (entityId: string) => ["atlas", "entity", entityId] as const,
  search: (input: { view: string; q: string }) =>
    ["atlas", "search", input.view, input.q.trim().toLowerCase()] as const,
};
