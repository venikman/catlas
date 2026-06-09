import { ATLAS_LOD_CONFIG, getLodForZoom, shouldFetchPoints } from "@catlas/atlas-react/lod";
import type { BenchmarkContext, ValidatorResult } from "../types";
import { computeBbox, scenarioUrl } from "../scenarios";
import { isServerReachable, pass, skip, tryFetchJson, fail } from "./helpers";

const DOC_BASE = "docs/adoption/benchmark-interpretation.md";

const DENSITY_THRESHOLD_TEACH = {
  docRef: `${DOC_BASE}#lod-density-threshold`,
  fix: "Ensure getLodForZoom returns the density layer for zooms below densityMaxZoom in lib/atlas/lod.ts.",
  loadBearing: true,
  rationale:
    "If low zoom does not select the density layer the viewer fetches heavier layers than the zoom warrants, breaking boundedness.",
} as const;

const CLUSTER_THRESHOLD_TEACH = {
  docRef: `${DOC_BASE}#lod-cluster-threshold`,
  fix: "Ensure getLodForZoom returns the clusters layer at densityMaxZoom in lib/atlas/lod.ts.",
  loadBearing: true,
  rationale:
    "A wrong cluster threshold either skips clusters entirely or serves raw points too early, violating the LOD contract.",
} as const;

const POINT_THRESHOLD_TEACH = {
  docRef: `${DOC_BASE}#lod-point-threshold`,
  fix: "Ensure shouldFetchPoints returns true only at or above pointsMinZoom in lib/atlas/lod.ts.",
  loadBearing: true,
  rationale:
    "If raw point fetches are not gated to high zoom, low-zoom views can request the full dataset and blow the payload hard cap.",
} as const;

export async function lodValidator(context: BenchmarkContext): Promise<ValidatorResult> {
  const results = [
    getLodForZoom(ATLAS_LOD_CONFIG.densityMaxZoom - 0.01).layer === "density"
      ? pass("lod-density-threshold", "lod", "Low zoom selects density", "Zoom below densityMaxZoom selects density.", DENSITY_THRESHOLD_TEACH)
      : fail("lod-density-threshold", "lod", "Low zoom selects density", "Zoom below densityMaxZoom did not select density.", DENSITY_THRESHOLD_TEACH),
    getLodForZoom(ATLAS_LOD_CONFIG.densityMaxZoom).layer === "clusters"
      ? pass("lod-cluster-threshold", "lod", "Medium zoom selects clusters", "Zoom at densityMaxZoom selects clusters.", CLUSTER_THRESHOLD_TEACH)
      : fail("lod-cluster-threshold", "lod", "Medium zoom selects clusters", "Zoom at densityMaxZoom did not select clusters.", CLUSTER_THRESHOLD_TEACH),
    shouldFetchPoints(ATLAS_LOD_CONFIG.pointsMinZoom)
      ? pass("lod-point-threshold", "lod", "High zoom permits points", "Zoom at pointsMinZoom permits raw point fetches.", POINT_THRESHOLD_TEACH)
      : fail("lod-point-threshold", "lod", "High zoom permits points", "Zoom at pointsMinZoom did not permit raw point fetches.", POINT_THRESHOLD_TEACH),
  ];

  if (!(await isServerReachable(context.baseUrl))) {
    results.push(
      skip(
        "lod-runtime-skip",
        "lod",
        "Runtime LOD endpoint check",
        `Server not reachable at ${context.baseUrl}; pure LOD checks still ran.`,
      ),
    );
    return { validator: "lod", results };
  }

  const lowZoomPointsUrl = scenarioUrl(context.baseUrl, context.view, {
    endpoint: "points",
    expectStatus: 400,
    id: "points-low",
    label: "points rejected at low zoom",
    zoom: 1.4,
    bbox: computeBbox(1.1, 0.42, 1.4),
  });
  const lowZoomPoints = await tryFetchJson(lowZoomPointsUrl);
  results.push(
    lowZoomPoints.status === 400
      ? pass(
          "lod-low-raw-reject",
          "lod",
          "Low zoom raw points are rejected",
          `Points endpoint returned expected status 400 at low zoom in ${lowZoomPoints.ms} ms.`,
          { measured: lowZoomPoints.ms, unit: "ms" },
        )
      : fail(
          "lod-low-raw-reject",
          "lod",
          "Low zoom raw points are rejected",
          `Expected 400, received ${lowZoomPoints.status}.`,
        ),
  );

  return { validator: "lod", results };
}
