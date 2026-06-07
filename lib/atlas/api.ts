import type {
  AtlasBbox,
  AtlasCluster,
  AtlasDensityTile,
  AtlasEntityDetails,
  AtlasPoint,
  AtlasSearchResult,
  AtlasView,
} from "./types";
import { getLodForZoom } from "./lod";

export type AtlasResponseMetrics = {
  count?: number;
  limit?: number;
  serverTimingMs?: number;
  timings?: Record<string, number>;
  truncated?: boolean;
};

export type AtlasViewsResponse = {
  count?: number;
  limit?: number;
  serverTimingMs?: number;
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
      zoom: number;
      bbox: AtlasBbox;
      count: number;
      limit: number;
      serverTimingMs?: number;
      timings?: Record<string, number>;
      truncated: boolean;
      tiles: AtlasDensityTile[];
    }
  | {
      lod: "clusters";
      view: string;
      zoom: number;
      bbox: AtlasBbox;
      count: number;
      limit: number;
      representativeLimit: number;
      representativePointCount: number;
      representativeTruncated: boolean;
      serverTimingMs?: number;
      timings?: Record<string, number>;
      truncated: boolean;
      clusters: AtlasCluster[];
      representativePoints: AtlasPoint[];
    }
  | {
      lod: "points";
      view: string;
      bbox: AtlasBbox;
      count: number;
      limit: number;
      serverTimingMs?: number;
      timings?: Record<string, number>;
      truncated: boolean;
      points: AtlasPoint[];
    };

function withBbox(url: URL, bbox: AtlasBbox) {
  url.searchParams.set("minX", String(bbox.minX));
  url.searchParams.set("maxX", String(bbox.maxX));
  url.searchParams.set("minY", String(bbox.minY));
  url.searchParams.set("maxY", String(bbox.maxY));
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const startedAt = performance.now();
  const response = await fetch(url, { signal });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string | { message?: string };
    } | null;
    const message =
      typeof body?.error === "string"
        ? body.error
        : body?.error?.message ?? `Request failed with ${response.status}`;
    throw new Error(message);
  }
  const body = (await response.json()) as T;
  if (body && typeof body === "object") {
    (body as T & { clientRequestMs?: number }).clientRequestMs = Number(
      (performance.now() - startedAt).toFixed(2),
    );
  }
  return body;
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
  const endpoint = getLodForZoom(input.zoom).endpoint;
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
}): Promise<{ results: AtlasSearchResult[] } & AtlasResponseMetrics> {
  const url = new URL("/api/atlas/search", window.location.origin);
  url.searchParams.set("view", input.view);
  url.searchParams.set("q", input.q);
  return fetchJson<{ results: AtlasSearchResult[] }>(
    url.toString(),
    input.signal,
  );
}
