import type { AtlasBbox } from "../lib/atlas/types";

// Scenario bboxes are produced with the SAME formula AtlasViewer uses
// (computeBbox), so they land on real data in the demo/synthetic dataset.
const round4 = (n: number) => Number(n.toFixed(4));

export function computeBbox(centerX: number, centerY: number, zoom: number): AtlasBbox {
  const spanX = 15 / Math.pow(1.32, zoom);
  const spanY = spanX * 0.72;
  return {
    minX: round4(centerX - spanX / 2),
    maxX: round4(centerX + spanX / 2),
    minY: round4(centerY - spanY / 2),
    maxY: round4(centerY + spanY / 2),
  };
}

const CENTER = { x: 1.1, y: 0.42 };

export type Endpoint = "views" | "density" | "clusters" | "points" | "search" | "entity";

export interface ApiScenario {
  id: string;
  label: string;
  endpoint: Endpoint;
  lod?: "density" | "clusters" | "points";
  zoom?: number;
  bbox?: AtlasBbox;
  query?: Record<string, string>;
  omitView?: boolean;
  expectStatus: number;
  /** Soft expectation: warn (don't fail) if the response has zero rows. */
  expectNonEmpty?: boolean;
}

// Positive scenarios — should succeed and return bounded payloads.
export const POSITIVE_SCENARIOS: ApiScenario[] = [
  { id: "views", label: "Views list", endpoint: "views", expectStatus: 200, expectNonEmpty: true },
  {
    id: "density-low",
    label: "Low zoom → density islands",
    endpoint: "density",
    lod: "density",
    zoom: 1.5,
    bbox: computeBbox(CENTER.x, CENTER.y, 1.5),
    expectStatus: 200,
    expectNonEmpty: true,
  },
  {
    id: "clusters-mid",
    label: "Medium zoom → clusters",
    endpoint: "clusters",
    lod: "clusters",
    zoom: 4.5,
    bbox: computeBbox(CENTER.x, CENTER.y, 4.5),
    expectStatus: 200,
    expectNonEmpty: true,
  },
  {
    id: "points-high",
    label: "High zoom → points (small bbox)",
    endpoint: "points",
    lod: "points",
    zoom: 7.2,
    bbox: computeBbox(CENTER.x, CENTER.y, 7.2),
    expectStatus: 200,
  },
  {
    id: "search",
    label: "Search (bounded, lightweight)",
    endpoint: "search",
    query: { limit: "20", q: "graph" },
    expectStatus: 200,
  },
  {
    id: "empty-high",
    label: "Empty viewport (no crash, stable empty state)",
    endpoint: "points",
    lod: "points",
    zoom: 7.2,
    bbox: computeBbox(900, 900, 7.2),
    expectStatus: 200,
  },
];

// Negative scenarios — should be rejected with a stable error shape.
export const NEGATIVE_SCENARIOS: ApiScenario[] = [
  {
    id: "points-at-low-zoom",
    label: "Points endpoint rejected at low zoom (LOD contract)",
    endpoint: "points",
    zoom: 1.5,
    bbox: computeBbox(CENTER.x, CENTER.y, 1.5),
    expectStatus: 400,
  },
  {
    id: "inverted-bbox",
    label: "Inverted bbox rejected",
    endpoint: "density",
    zoom: 1.5,
    bbox: { minX: 5, maxX: 1, minY: 5, maxY: 1 },
    expectStatus: 400,
  },
  {
    id: "missing-view",
    label: "Missing view rejected",
    endpoint: "density",
    zoom: 1.5,
    bbox: computeBbox(CENTER.x, CENTER.y, 1.5),
    omitView: true,
    expectStatus: 400,
  },
  {
    id: "oversized-high-zoom-bbox",
    label: "Oversized high-zoom bbox rejected",
    endpoint: "points",
    zoom: 7.2,
    bbox: { minX: -30, maxX: 30, minY: -30, maxY: 30 },
    expectStatus: 400,
  },
  {
    id: "out-of-range-zoom",
    label: "Out-of-range zoom rejected",
    endpoint: "density",
    zoom: 999,
    bbox: computeBbox(CENTER.x, CENTER.y, 1.5),
    expectStatus: 400,
  },
];

/** Build a request URL for a scenario against a base URL + view slug. */
export function scenarioUrl(baseUrl: string, view: string, s: ApiScenario, entityId?: string): string {
  if (s.endpoint === "views") return `${baseUrl}/api/atlas/views`;
  if (s.endpoint === "entity") return `${baseUrl}/api/atlas/entity/${encodeURIComponent(entityId ?? "missing")}`;

  const params = new URLSearchParams();
  if (!s.omitView) params.set("view", view);
  if (s.zoom !== undefined) params.set("zoom", String(s.zoom));
  if (s.bbox) {
    params.set("minX", String(s.bbox.minX));
    params.set("maxX", String(s.bbox.maxX));
    params.set("minY", String(s.bbox.minY));
    params.set("maxY", String(s.bbox.maxY));
  }
  for (const [k, v] of Object.entries(s.query ?? {})) params.set(k, v);
  return `${baseUrl}/api/atlas/${s.endpoint}?${params.toString()}`;
}
