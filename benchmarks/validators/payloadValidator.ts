import { ATLAS_BUDGETS, BUDGETS } from "../budgets";
import { computeBbox, scenarioUrl } from "../scenarios";
import type { BenchmarkContext, CheckResult, ValidatorResult } from "../types";
import { fail, isServerReachable, pass, skip, tryFetchJson, warn } from "./helpers";

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
        )
      : pass(
          "payload-points-no-metadata",
          "payload",
          "Point list omits heavy metadata",
          "No point response rows contained metadata or non-empty payloadSummary.",
        ),
  );

  return { validator: "payload", results };
}
