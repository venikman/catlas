import { getAtlasSourceMode, listAtlasClusters, listAtlasPoints } from "@/lib/atlas/db";
import {
  isTruncated,
  lightweightClusters,
  lightweightPoints,
} from "@/lib/atlas/responseShaping";
import { ATLAS_RUNTIME_CONFIG } from "@/lib/atlas/runtimeConfig";
import { atlasError, atlasJson, createAtlasRouteTimer, logAtlasRequest } from "@/lib/atlas/serverTiming";
import { parseAtlasBboxParams } from "@/lib/atlas/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const timer = createAtlasRouteTimer("clusters");
  if (getAtlasSourceMode() === "unavailable") {
    return atlasError("DATABASE_URL is not configured.", {
      code: "ATLAS_DATABASE_UNAVAILABLE",
      status: 503,
      timer,
      ttlSeconds: 0,
    });
  }

  const validationStartedAt = performance.now();
  const parsed = parseAtlasBboxParams(new URL(request.url).searchParams);
  timer.mark("validation", validationStartedAt);
  if (!parsed.ok) {
    return atlasError(parsed.error, {
      code: "ATLAS_INVALID_VIEWPORT",
      status: parsed.status,
      timer,
      ttlSeconds: 0,
    });
  }

  const clusterLimit = Math.min(
    parsed.value.limit,
    ATLAS_RUNTIME_CONFIG.limits.maxClusters,
  );
  const representativeLimit = ATLAS_RUNTIME_CONFIG.limits.maxRepresentativePoints;
  const [rawClusters, rawRepresentativePoints] = await timer.measure("query", () =>
    Promise.all([
      listAtlasClusters({
        view: parsed.value.view,
        bbox: parsed.value.bbox,
        limit: clusterLimit,
      }),
      listAtlasPoints({
        view: parsed.value.view,
        bbox: parsed.value.bbox,
        limit: representativeLimit,
      }),
    ]),
  );
  const serializationStartedAt = performance.now();
  const clusters = lightweightClusters(rawClusters);
  const representativePoints = lightweightPoints(rawRepresentativePoints);
  timer.mark("serialize", serializationStartedAt);
  logAtlasRequest({
    bbox: parsed.value.bbox,
    count: clusters.length,
    limit: clusterLimit,
    route: "clusters",
    timer,
    view: parsed.value.view,
  });

  return atlasJson({
    lod: "clusters",
    view: parsed.value.view,
    zoom: parsed.value.zoom,
    bbox: parsed.value.bbox,
    count: clusters.length,
    limit: clusterLimit,
    truncated: isTruncated(clusters.length, clusterLimit),
    representativePointCount: representativePoints.length,
    representativeLimit,
    representativeTruncated: isTruncated(
      representativePoints.length,
      representativeLimit,
    ),
    ...timer.meta(),
    clusters,
    representativePoints,
  }, {
    timer,
    ttlSeconds: ATLAS_RUNTIME_CONFIG.cacheTtlSeconds.mediumZoom,
  });
}
