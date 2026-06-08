import { ATLAS_LOD_CONFIG, getLodForZoom, shouldFetchPoints } from "@catlas/atlas-react/lod";
import type { BenchmarkContext, ValidatorResult } from "../types";
import { computeBbox, scenarioUrl } from "../scenarios";
import { isServerReachable, pass, skip, tryFetchJson, fail } from "./helpers";

export async function lodValidator(context: BenchmarkContext): Promise<ValidatorResult> {
  const results = [
    getLodForZoom(ATLAS_LOD_CONFIG.densityMaxZoom - 0.01).layer === "density"
      ? pass("lod-density-threshold", "lod", "Low zoom selects density", "Zoom below densityMaxZoom selects density.")
      : fail("lod-density-threshold", "lod", "Low zoom selects density", "Zoom below densityMaxZoom did not select density."),
    getLodForZoom(ATLAS_LOD_CONFIG.densityMaxZoom).layer === "clusters"
      ? pass("lod-cluster-threshold", "lod", "Medium zoom selects clusters", "Zoom at densityMaxZoom selects clusters.")
      : fail("lod-cluster-threshold", "lod", "Medium zoom selects clusters", "Zoom at densityMaxZoom did not select clusters."),
    shouldFetchPoints(ATLAS_LOD_CONFIG.pointsMinZoom)
      ? pass("lod-point-threshold", "lod", "High zoom permits points", "Zoom at pointsMinZoom permits raw point fetches.")
      : fail("lod-point-threshold", "lod", "High zoom permits points", "Zoom at pointsMinZoom did not permit raw point fetches."),
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
