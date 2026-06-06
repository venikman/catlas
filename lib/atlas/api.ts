import type {
  AtlasBbox,
  AtlasCluster,
  AtlasDensityTile,
  AtlasEntityDetails,
  AtlasPoint,
  AtlasSearchResult,
  AtlasView,
} from "./types";

export type AtlasViewsResponse = {
  views: AtlasView[];
  stats: {
    source: string;
    entityCount: number;
    pointRows: number;
  };
};

export type AtlasViewportResponse =
  | {
      lod: "density";
      view: string;
      bbox: AtlasBbox;
      count: number;
      tiles: AtlasDensityTile[];
    }
  | {
      lod: "clusters";
      view: string;
      bbox: AtlasBbox;
      count: number;
      clusters: AtlasCluster[];
      representativePoints: AtlasPoint[];
    }
  | {
      lod: "points";
      view: string;
      bbox: AtlasBbox;
      count: number;
      limit: number;
      points: AtlasPoint[];
    };

function withBbox(url: URL, bbox: AtlasBbox) {
  url.searchParams.set("minX", String(bbox.minX));
  url.searchParams.set("maxX", String(bbox.maxX));
  url.searchParams.set("minY", String(bbox.minY));
  url.searchParams.set("maxY", String(bbox.maxY));
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchAtlasViews(signal?: AbortSignal) {
  return fetchJson<AtlasViewsResponse>("/api/atlas/views", signal);
}

export async function fetchViewportData(input: {
  view: string;
  zoom: number;
  bbox: AtlasBbox;
  signal?: AbortSignal;
}): Promise<AtlasViewportResponse> {
  const endpoint =
    input.zoom < 3
      ? "/api/atlas/density"
      : input.zoom < 6.01
        ? "/api/atlas/clusters"
        : "/api/atlas/points";
  const url = new URL(endpoint, window.location.origin);
  url.searchParams.set("view", input.view);
  url.searchParams.set("zoom", String(input.zoom));
  withBbox(url, input.bbox);
  return fetchJson<AtlasViewportResponse>(url.toString(), input.signal);
}

export async function fetchAtlasEntity(
  entityId: string,
  signal?: AbortSignal,
): Promise<{ entity: AtlasEntityDetails }> {
  return fetchJson<{ entity: AtlasEntityDetails }>(
    `/api/atlas/entity/${encodeURIComponent(entityId)}`,
    signal,
  );
}

export async function searchAtlas(input: {
  view: string;
  q: string;
  signal?: AbortSignal;
}): Promise<{ results: AtlasSearchResult[] }> {
  const url = new URL("/api/atlas/search", window.location.origin);
  url.searchParams.set("view", input.view);
  url.searchParams.set("q", input.q);
  return fetchJson<{ results: AtlasSearchResult[] }>(
    url.toString(),
    input.signal,
  );
}
