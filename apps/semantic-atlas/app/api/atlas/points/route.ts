import { getAtlasSourceMode } from "@/lib/atlas/db";
import { shouldFetchPoints } from "@/lib/atlas/lod";
import { isTruncated, lightweightPoints } from "@/lib/atlas/responseShaping";
import { ATLAS_RUNTIME_CONFIG } from "@/lib/atlas/runtimeConfig";
import { atlasError, atlasJson, createAtlasRouteTimer, logAtlasRequest } from "@/lib/atlas/serverTiming";
import { getAtlasStore } from "@/lib/atlas/store";
import { parseAtlasBboxParams } from "@/lib/atlas/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const timer = createAtlasRouteTimer("points");
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
  if (!shouldFetchPoints(parsed.value.zoom)) {
    return atlasError("Raw point queries are only available at high zoom.", {
      code: "ATLAS_LOD_REJECTED",
      status: 400,
      timer,
      ttlSeconds: 0,
    });
  }

  const limit = Math.min(parsed.value.limit, ATLAS_RUNTIME_CONFIG.limits.maxPoints);
  const rawPoints = await timer.measure("query", () =>
    getAtlasStore().listPoints({ ...parsed.value, limit }),
  );
  const serializationStartedAt = performance.now();
  const points = lightweightPoints(rawPoints);
  timer.mark("serialize", serializationStartedAt);
  logAtlasRequest({
    bbox: parsed.value.bbox,
    count: points.length,
    limit,
    route: "points",
    timer,
    view: parsed.value.view,
  });

  return atlasJson({
    lod: "points",
    view: parsed.value.view,
    zoom: parsed.value.zoom,
    bbox: parsed.value.bbox,
    count: points.length,
    limit,
    truncated: isTruncated(points.length, limit),
    ...timer.meta(),
    points,
  }, {
    timer,
    ttlSeconds: ATLAS_RUNTIME_CONFIG.cacheTtlSeconds.highZoom,
  });
}
