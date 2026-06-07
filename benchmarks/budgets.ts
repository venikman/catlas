export const ATLAS_BUDGETS = {
  webVitals: {
    lcpMs: { good: 2500, sota: 1500 },
    inpMs: { good: 200, sota: 100 },
    cls: { good: 0.1, sota: 0.03 },
  },

  coldStart: {
    atlasShellMs: { good: 1000, sota: 500 },
    firstMeaningfulAtlasRenderMs: { good: 2500, sota: 1200 },
    initialAtlasPayloadBytes: { good: 1_000_000, sota: 500_000 },
    rawPointRequestsAllowed: 0,
  },

  apiP95Ms: {
    views: { good: 100, sota: 50 },
    density: { good: 250, sota: 120 },
    clusters: { good: 250, sota: 120 },
    points: { good: 300, sota: 150 },
    entity: { good: 150, sota: 75 },
    search: { good: 300, sota: 150 },
  },

  payloadBytes: {
    initialAtlas: { good: 1_000_000, sota: 500_000 },
    density: { good: 500_000, sota: 200_000 },
    clusters: { good: 500_000, sota: 250_000 },
    points: { good: 2_000_000, sota: 750_000 },
    entity: { good: 100_000, sota: 25_000 },
    search: { good: 100_000, sota: 25_000 },
  },

  responseLimits: {
    maxViewportPoints: 20_000,
    maxClusters: 2_000,
    maxSearchResults: 20,
    maxLabelsLowZoom: 50,
    maxLabelsMediumZoom: 200,
  },

  rendering: {
    idleFps: { good: 50, sota: 60 },
    panZoomFpsP95: { good: 45, sota: 55 },
    frameTimeP95Ms: { good: 32, sota: 20 },
    preferredFrameTimeMs: 16.7,
    maxReactPointComponents: 0,
  },

  interaction: {
    hoverFeedbackMs: { good: 100, sota: 50 },
    clickToPanelShellMs: { good: 200, sota: 100 },
    entityDetailsMs: { good: 500, sota: 200 },
    searchResultsMs: { good: 500, sota: 200 },
    flyToStartMs: { good: 100, sota: 50 },
    viewSwitchStartMs: { good: 100, sota: 50 },
    viewSwitchDurationMs: { min: 300, target: 500, max: 800 },
  },

  lodInvariants: {
    lowZoomRawPointRequestsAllowed: 0,
    mediumZoomRawAllPointRequestsAllowed: 0,
    highZoomRequiresBbox: true,
    pointsEndpointRequiresView: true,
    pointsEndpointRequiresZoom: true,
    bulkPointMetadataForbidden: true,
  },

  scaleTargets: {
    current: {
      records: 170_000,
      expected: "smooth",
    },
    nearTerm: {
      records: 1_000_000,
      expected: "smooth through LOD and bounded viewport rendering",
    },
    longTerm: {
      records: 10_000_000,
      expected: "architecture-safe; no raw full fetch/render",
    },
  },
} as const;

function envNum(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

// Compatibility shape for the current validators. These values now derive from
// ATLAS_BUDGETS so future validators can score against both good and SOTA tiers.
export const BUDGETS = {
  bounds: {
    maxPointsPerResponse: ATLAS_BUDGETS.responseLimits.maxViewportPoints,
    maxClustersPerResponse: ATLAS_BUDGETS.responseLimits.maxClusters,
    maxDensityTilesPerResponse: 240,
    maxSearchResults: ATLAS_BUDGETS.responseLimits.maxSearchResults,
    maxBboxSpan: 80,
    maxHighZoomBboxSpan: 12,
    densityMaxZoom: 3,
    pointsMinZoom: 6.01,
  },

  apiLatencyMsP95: {
    views: envNum("BENCH_API_VIEWS_P95", ATLAS_BUDGETS.apiP95Ms.views.good),
    density: envNum("BENCH_API_DENSITY_P95", ATLAS_BUDGETS.apiP95Ms.density.good),
    clusters: envNum(
      "BENCH_API_CLUSTERS_P95",
      ATLAS_BUDGETS.apiP95Ms.clusters.good,
    ),
    points: envNum("BENCH_API_POINTS_P95", ATLAS_BUDGETS.apiP95Ms.points.good),
    entity: envNum("BENCH_API_ENTITY_P95", ATLAS_BUDGETS.apiP95Ms.entity.good),
    search: envNum("BENCH_API_SEARCH_P95", ATLAS_BUDGETS.apiP95Ms.search.good),
  },

  payloadBytes: {
    densitySoftTarget: envNum(
      "BENCH_PAYLOAD_DENSITY",
      ATLAS_BUDGETS.payloadBytes.density.good,
    ),
    clustersSoftTarget: envNum(
      "BENCH_PAYLOAD_CLUSTERS",
      ATLAS_BUDGETS.payloadBytes.clusters.good,
    ),
    pointsHardCap: envNum(
      "BENCH_PAYLOAD_POINTS_CAP",
      ATLAS_BUDGETS.payloadBytes.points.good,
    ),
    initialSoftTarget: envNum(
      "BENCH_PAYLOAD_INITIAL",
      ATLAS_BUDGETS.payloadBytes.initialAtlas.good,
    ),
  },

  hardCaps: {
    initialAtlasPayloadBytes: envNum("BENCH_HARD_INITIAL_PAYLOAD", 2_000_000),
    highZoomPointPayloadBytes: envNum("BENCH_HARD_POINTS_PAYLOAD", 5_000_000),
  },

  webVitals: {
    lcpMs: envNum("BENCH_LCP", ATLAS_BUDGETS.webVitals.lcpMs.good),
    inpMs: envNum("BENCH_INP", ATLAS_BUDGETS.webVitals.inpMs.good),
    cls: envNum("BENCH_CLS", ATLAS_BUDGETS.webVitals.cls.good),
    coldStartMs: envNum(
      "BENCH_COLD_START",
      ATLAS_BUDGETS.coldStart.firstMeaningfulAtlasRenderMs.good,
    ),
  },

  interaction: {
    panFrameP95Ms: envNum(
      "BENCH_PAN_FRAME_P95",
      ATLAS_BUDGETS.rendering.frameTimeP95Ms.good,
    ),
    zoomFrameP95Ms: envNum(
      "BENCH_ZOOM_FRAME_P95",
      ATLAS_BUDGETS.rendering.frameTimeP95Ms.good,
    ),
    preferredFrameMs: ATLAS_BUDGETS.rendering.preferredFrameTimeMs,
    hoverFeedbackMs: envNum(
      "BENCH_HOVER",
      ATLAS_BUDGETS.interaction.hoverFeedbackMs.good,
    ),
    clickToPanelMs: envNum(
      "BENCH_CLICK_PANEL",
      ATLAS_BUDGETS.interaction.clickToPanelShellMs.good,
    ),
  },
} as const;

export type AtlasBudgets = typeof ATLAS_BUDGETS;
export type Budgets = typeof BUDGETS;
