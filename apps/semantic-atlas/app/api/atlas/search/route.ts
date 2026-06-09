import { getAtlasSourceMode } from "@/lib/atlas/db";
import { isTruncated } from "@/lib/atlas/responseShaping";
import { ATLAS_RUNTIME_CONFIG } from "@/lib/atlas/runtimeConfig";
import { atlasError, atlasJson, createAtlasRouteTimer, logAtlasRequest } from "@/lib/atlas/serverTiming";
import { getAtlasStore } from "@/lib/atlas/store";
import { parseAtlasSearchParams } from "@/lib/atlas/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const timer = createAtlasRouteTimer("search");
  if (getAtlasSourceMode() === "unavailable") {
    return atlasError("DATABASE_URL is not configured.", {
      code: "ATLAS_DATABASE_UNAVAILABLE",
      status: 503,
      timer,
      ttlSeconds: 0,
    });
  }

  const validationStartedAt = performance.now();
  const parsed = parseAtlasSearchParams(new URL(request.url).searchParams);
  timer.mark("validation", validationStartedAt);
  if (!parsed.ok) {
    return atlasError(parsed.error, {
      code: "ATLAS_INVALID_SEARCH",
      status: parsed.status,
      timer,
      ttlSeconds: 0,
    });
  }

  const limit = Math.min(parsed.value.limit, ATLAS_RUNTIME_CONFIG.limits.maxSearchResults);
  const results = await timer.measure("query", () =>
    getAtlasStore().search({ ...parsed.value, limit }),
  );
  const serializationStartedAt = performance.now();
  timer.mark("serialize", serializationStartedAt);
  logAtlasRequest({
    count: results.length,
    limit,
    route: "search",
    timer,
    view: parsed.value.view,
  });

  return atlasJson({
    view: parsed.value.view,
    q: parsed.value.q,
    count: results.length,
    limit,
    truncated: isTruncated(results.length, limit),
    ...timer.meta(),
    results,
  }, {
    timer,
    ttlSeconds: ATLAS_RUNTIME_CONFIG.cacheTtlSeconds.search,
  });
}
