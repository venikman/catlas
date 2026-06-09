import { getAtlasSourceMode } from "@/lib/atlas/db";
import { lightweightEntity } from "@/lib/atlas/responseShaping";
import { ATLAS_RUNTIME_CONFIG } from "@/lib/atlas/runtimeConfig";
import { atlasError, atlasJson, createAtlasRouteTimer, logAtlasRequest } from "@/lib/atlas/serverTiming";
import { getAtlasStore } from "@/lib/atlas/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const timer = createAtlasRouteTimer("entity");
  if (getAtlasSourceMode() === "unavailable") {
    return atlasError("DATABASE_URL is not configured.", {
      code: "ATLAS_DATABASE_UNAVAILABLE",
      status: 503,
      timer,
      ttlSeconds: 0,
    });
  }

  const validationStartedAt = performance.now();
  const { id } = await context.params;
  timer.mark("validation", validationStartedAt);
  if (!id || id.length > 160) {
    return atlasError("Invalid entity id.", {
      code: "ATLAS_INVALID_ENTITY_ID",
      status: 400,
      timer,
      ttlSeconds: 0,
    });
  }

  const rawEntity = await timer.measure("query", () => getAtlasStore().getEntity(id));
  if (!rawEntity) {
    return atlasError("Entity not found.", {
      code: "ATLAS_ENTITY_NOT_FOUND",
      status: 404,
      timer,
      ttlSeconds: ATLAS_RUNTIME_CONFIG.cacheTtlSeconds.entity,
    });
  }

  const serializationStartedAt = performance.now();
  const entity = lightweightEntity(rawEntity);
  timer.mark("serialize", serializationStartedAt);
  logAtlasRequest({
    count: 1,
    route: "entity",
    timer,
  });

  return atlasJson({
    count: 1,
    limit: 1,
    truncated: false,
    ...timer.meta(),
    entity,
  }, {
    timer,
    ttlSeconds: ATLAS_RUNTIME_CONFIG.cacheTtlSeconds.entity,
  });
}
