import type { AtlasLodLayer } from "./types";

export const ATLAS_CLIENT_CACHE = {
  views: {
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  },
  density: {
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  },
  clusters: {
    staleTime: 90_000,
    gcTime: 10 * 60_000,
  },
  points: {
    staleTime: 12_000,
    gcTime: 2 * 60_000,
  },
  entity: {
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  },
  search: {
    staleTime: 45_000,
    gcTime: 5 * 60_000,
  },
} as const;

export function viewportCachePolicy(lod: AtlasLodLayer): {
  gcTime: number;
  staleTime: number;
} {
  return ATLAS_CLIENT_CACHE[lod];
}
