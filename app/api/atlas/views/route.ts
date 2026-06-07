import { getAtlasSourceMode, getAtlasStats, listAtlasViews } from "@/lib/atlas/db";
import { ATLAS_RUNTIME_CONFIG } from "@/lib/atlas/runtimeConfig";
import { atlasError, atlasJson, createAtlasRouteTimer, logAtlasRequest } from "@/lib/atlas/serverTiming";

export const dynamic = "force-dynamic";

export async function GET() {
  const timer = createAtlasRouteTimer("views");
  if (getAtlasSourceMode() === "unavailable") {
    return atlasError("DATABASE_URL is not configured.", {
      code: "ATLAS_DATABASE_UNAVAILABLE",
      status: 503,
      timer,
      ttlSeconds: 0,
    });
  }

  const [views, stats] = await timer.measure("query", () =>
    Promise.all([listAtlasViews(), getAtlasStats()]),
  );
  const serializationStartedAt = performance.now();
  timer.mark("serialize", serializationStartedAt);
  logAtlasRequest({
    count: views.length,
    route: "views",
    timer,
  });

  return atlasJson({
    count: views.length,
    limit: views.length,
    truncated: false,
    ...timer.meta(),
    views,
    stats,
  }, {
    timer,
    ttlSeconds: ATLAS_RUNTIME_CONFIG.cacheTtlSeconds.views,
  });
}
