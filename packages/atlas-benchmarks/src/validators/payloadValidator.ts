import { ATLAS_BUDGETS, BUDGETS } from "../budgets";
import { computeBbox, scenarioUrl } from "../scenarios";
import type { BenchmarkContext, CheckResult, ValidatorResult } from "../types";
import { fail, isServerReachable, pass, skip, tryFetchJson, warn } from "./helpers";

const DOC_BASE = "docs/adoption/benchmark-interpretation.md";

const DENSITY_TEACH = {
  docRef: `${DOC_BASE}#payload-density-size`,
  fix: "Aggregate density into a coarser grid or quantize bin counts so the density payload stays under its soft target.",
  rationale:
    "Oversized density payloads slow the lowest-zoom first paint, but density is aggregated so this is advisory rather than gate-blocking.",
} as const;

const CLUSTERS_TEACH = {
  docRef: `${DOC_BASE}#payload-clusters-size`,
  fix: "Cap clusters per viewport and trim cluster DTO fields to keep the cluster payload under its soft target.",
  rationale:
    "Large cluster payloads add mid-zoom latency, but clusters are bounded by design so this is advisory rather than gate-blocking.",
} as const;

const POINTS_HARD_CAP_TEACH = {
  docRef: `${DOC_BASE}#payload-points-hard-cap`,
  fix: "Enforce the per-response point cap and viewport bbox in the points route, and shape rows through lightweightPoint.",
  loadBearing: true,
  rationale:
    "Exceeding the high-zoom points hard cap means a single request can stall the renderer and exhaust client memory; this is the boundedness backstop.",
} as const;

const POINTS_NO_METADATA_TEACH = {
  docRef: `${DOC_BASE}#payload-points-no-metadata`,
  fix: "Strip metadata and payloadSummary from bulk point rows via lightweightPoint in responseShaping.ts.",
  loadBearing: true,
  rationale:
    "Heavy per-point metadata in bulk responses multiplies payload size and breaks the points hard cap.",
} as const;

function hasHeavyPointMetadata(body: Record<string, unknown> | null): boolean {
  const points = body?.points;
  if (!Array.isArray(points)) return false;
  return points.some((point) => {
    if (!point || typeof point !== "object") return false;
    const record = point as Record<string, unknown>;
    return Boolean(record.metadata) || Boolean(record.payloadSummary);
  });
}

export async function payloadValidator(
  context: BenchmarkContext,
): Promise<ValidatorResult> {
  if (!(await isServerReachable(context.baseUrl))) {
    return {
      skipped: true,
      skipReason: `Server not reachable at ${context.baseUrl}.`,
      validator: "payload",
      results: [
        skip(
          "payload-server-unreachable",
          "payload",
          "Payload endpoints reachable",
          `Server not reachable at ${context.baseUrl}.`,
        ),
      ],
    };
  }

  const results: CheckResult[] = [];
  const density = await tryFetchJson(
    scenarioUrl(context.baseUrl, context.view, {
      bbox: computeBbox(1.1, 0.42, 1.5),
      endpoint: "density",
      expectStatus: 200,
      id: "density-payload",
      label: "density payload",
      zoom: 1.5,
    }),
  );
  const clusters = await tryFetchJson(
    scenarioUrl(context.baseUrl, context.view, {
      bbox: computeBbox(1.1, 0.42, 4.5),
      endpoint: "clusters",
      expectStatus: 200,
      id: "clusters-payload",
      label: "clusters payload",
      zoom: 4.5,
    }),
  );
  const points = await tryFetchJson(
    scenarioUrl(context.baseUrl, context.view, {
      bbox: computeBbox(1.1, 0.42, 7.2),
      endpoint: "points",
      expectStatus: 200,
      id: "points-payload",
      label: "points payload",
      zoom: 7.2,
    }),
  );

  results.push(
    density.bytes <= BUDGETS.payloadBytes.densitySoftTarget
      ? pass(
          "payload-density-size",
          "payload",
          "Density payload size",
          `Density payload was ${density.bytes} bytes.`,
          {
            ...DENSITY_TEACH,
            budget: BUDGETS.payloadBytes.densitySoftTarget,
            comparison: "lte",
            measured: density.bytes,
            severity: "warn",
            sotaBudget: ATLAS_BUDGETS.payloadBytes.density.sota,
            unit: "bytes",
          },
        )
      : warn(
          "payload-density-size",
          "payload",
          "Density payload size",
          `Density payload was ${density.bytes} bytes, above soft target ${BUDGETS.payloadBytes.densitySoftTarget}.`,
          {
            ...DENSITY_TEACH,
            budget: BUDGETS.payloadBytes.densitySoftTarget,
            comparison: "lte",
            measured: density.bytes,
            sotaBudget: ATLAS_BUDGETS.payloadBytes.density.sota,
            unit: "bytes",
          },
        ),
  );

  results.push(
    clusters.bytes <= BUDGETS.payloadBytes.clustersSoftTarget
      ? pass(
          "payload-clusters-size",
          "payload",
          "Cluster payload size",
          `Cluster payload was ${clusters.bytes} bytes.`,
          {
            ...CLUSTERS_TEACH,
            budget: BUDGETS.payloadBytes.clustersSoftTarget,
            comparison: "lte",
            measured: clusters.bytes,
            severity: "warn",
            sotaBudget: ATLAS_BUDGETS.payloadBytes.clusters.sota,
            unit: "bytes",
          },
        )
      : warn(
          "payload-clusters-size",
          "payload",
          "Cluster payload size",
          `Cluster payload was ${clusters.bytes} bytes, above soft target ${BUDGETS.payloadBytes.clustersSoftTarget}.`,
          {
            ...CLUSTERS_TEACH,
            budget: BUDGETS.payloadBytes.clustersSoftTarget,
            comparison: "lte",
            measured: clusters.bytes,
            sotaBudget: ATLAS_BUDGETS.payloadBytes.clusters.sota,
            unit: "bytes",
          },
        ),
  );

  results.push(
    points.bytes <= BUDGETS.hardCaps.highZoomPointPayloadBytes
      ? pass(
          "payload-points-hard-cap",
          "payload",
          "High-zoom points payload hard cap",
          `Points payload was ${points.bytes} bytes.`,
          {
            ...POINTS_HARD_CAP_TEACH,
            budget: BUDGETS.hardCaps.highZoomPointPayloadBytes,
            comparison: "lte",
            measured: points.bytes,
            sotaBudget: ATLAS_BUDGETS.payloadBytes.points.sota,
            unit: "bytes",
          },
        )
      : fail(
          "payload-points-hard-cap",
          "payload",
          "High-zoom points payload hard cap",
          `Points payload was ${points.bytes} bytes, above hard cap ${BUDGETS.hardCaps.highZoomPointPayloadBytes}.`,
          {
            ...POINTS_HARD_CAP_TEACH,
            budget: BUDGETS.hardCaps.highZoomPointPayloadBytes,
            comparison: "lte",
            measured: points.bytes,
            sotaBudget: ATLAS_BUDGETS.payloadBytes.points.sota,
            unit: "bytes",
          },
        ),
  );

  if (points.bytes > BUDGETS.payloadBytes.pointsHardCap) {
    results.push(
      warn(
        "payload-points-good-target",
        "payload",
        "High-zoom points payload good target",
        `Points payload was ${points.bytes} bytes, above good target ${BUDGETS.payloadBytes.pointsHardCap}.`,
        {
          budget: BUDGETS.payloadBytes.pointsHardCap,
          comparison: "lte",
          measured: points.bytes,
          sotaBudget: ATLAS_BUDGETS.payloadBytes.points.sota,
          unit: "bytes",
        },
      ),
    );
  }

  results.push(
    hasHeavyPointMetadata(points.body)
      ? fail(
          "payload-points-no-metadata",
          "payload",
          "Point list omits heavy metadata",
          "At least one point response row contained metadata or payloadSummary.",
          POINTS_NO_METADATA_TEACH,
        )
      : pass(
          "payload-points-no-metadata",
          "payload",
          "Point list omits heavy metadata",
          "No point response rows contained metadata or non-empty payloadSummary.",
          POINTS_NO_METADATA_TEACH,
        ),
  );

  return { validator: "payload", results };
}
