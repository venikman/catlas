import { ATLAS_LOD_CONFIG } from "./lod";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function envBool(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw === "true" || raw === "1";
}

export const ATLAS_RUNTIME_CONFIG = {
  debug: envBool("ATLAS_DEBUG", false),
  enableServerTiming: envBool("ATLAS_ENABLE_SERVER_TIMING", true),
  limits: {
    maxDensityTiles: envInt(
      "ATLAS_MAX_DENSITY_TILES_PER_RESPONSE",
      ATLAS_LOD_CONFIG.maxDensityTiles,
    ),
    maxClusters: envInt(
      "ATLAS_MAX_CLUSTERS_PER_RESPONSE",
      ATLAS_LOD_CONFIG.maxClusters,
    ),
    maxRepresentativePoints: envInt(
      "ATLAS_MAX_REPRESENTATIVE_POINTS_PER_RESPONSE",
      ATLAS_LOD_CONFIG.maxRepresentativePoints,
    ),
    maxPoints: envInt(
      "ATLAS_MAX_POINTS_PER_RESPONSE",
      ATLAS_LOD_CONFIG.maxPoints,
    ),
    maxSearchResults: envInt(
      "ATLAS_MAX_SEARCH_RESULTS",
      ATLAS_LOD_CONFIG.maxSearchResults,
    ),
    maxSearchCandidates: envInt("ATLAS_MAX_SEARCH_CANDIDATES", 2000),
    maxBboxSpan: envInt("ATLAS_MAX_BBOX_SPAN", 80),
    maxHighZoomBboxSpan: envInt("ATLAS_MAX_HIGH_ZOOM_BBOX_SPAN", 12),
  },
  cacheTtlSeconds: {
    views: envInt("ATLAS_CACHE_TTL_VIEWS", 300),
    lowZoom: envInt("ATLAS_CACHE_TTL_LOW_ZOOM", 300),
    mediumZoom: envInt("ATLAS_CACHE_TTL_MEDIUM_ZOOM", 90),
    highZoom: envInt("ATLAS_CACHE_TTL_HIGH_ZOOM", 20),
    entity: envInt("ATLAS_CACHE_TTL_ENTITY", 300),
    search: envInt("ATLAS_CACHE_TTL_SEARCH", 45),
  },
} as const;

export function cacheHeader(ttlSeconds: number): string {
  if (ttlSeconds <= 0) return "no-store";
  return `public, max-age=0, s-maxage=${ttlSeconds}, stale-while-revalidate=${Math.max(
    ttlSeconds,
    30,
  )}`;
}
