import { getAtlasSourceMode } from "@/lib/atlas/db";
import { isTruncated } from "@/lib/atlas/responseShaping";
import { ATLAS_RUNTIME_CONFIG } from "@/lib/atlas/runtimeConfig";
import { atlasError, atlasJson, createAtlasRouteTimer, logAtlasRequest } from "@/lib/atlas/serverTiming";
import { getAtlasStore } from "@/lib/atlas/store";
import { parseAtlasBboxParams } from "@/lib/atlas/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const timer = createAtlasRouteTimer("density");
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

  const limit = Math.min(parsed.value.limit, ATLAS_RUNTIME_CONFIG.limits.maxDensityTiles);
  const tiles = await timer.measure("query", () =>
    getAtlasStore().listDensityTiles({
      view: parsed.value.view,
      bbox: parsed.value.bbox,
      limit,
    }),
  );
  const serializationStartedAt = performance.now();
  timer.mark("serialize", serializationStartedAt);
  logAtlasRequest({
    bbox: parsed.value.bbox,
    count: tiles.length,
    limit,
    route: "density",
    timer,
    view: parsed.value.view,
  });

  return atlasJson({
    lod: "density",
    view: parsed.value.view,
    zoom: parsed.value.zoom,
    bbox: parsed.value.bbox,
    count: tiles.length,
    limit,
    truncated: isTruncated(tiles.length, limit),
    ...timer.meta(),
    tiles,
  }, {
    timer,
    ttlSeconds: ATLAS_RUNTIME_CONFIG.cacheTtlSeconds.lowZoom,
  });
}
