import { getAtlasEntity, getAtlasSourceMode } from "@/lib/atlas/db";
import { jsonError } from "@/lib/atlas/validation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (getAtlasSourceMode() === "unavailable") {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const { id } = await context.params;
  if (!id || id.length > 160) {
    return jsonError("Invalid entity id.", 400);
  }

  const entity = await getAtlasEntity(id);
  if (!entity) {
    return jsonError("Entity not found.", 404);
  }

  return Response.json({ entity });
}
