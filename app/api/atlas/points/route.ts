import { getAtlasSourceMode, listAtlasPoints } from "@/lib/atlas/db";
import { shouldFetchPoints } from "@/lib/atlas/lod";
import { jsonError, parseAtlasBboxParams } from "@/lib/atlas/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (getAtlasSourceMode() === "unavailable") {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const parsed = parseAtlasBboxParams(new URL(request.url).searchParams);
  if (!parsed.ok) return jsonError(parsed.error, parsed.status);
  if (!shouldFetchPoints(parsed.value.zoom)) {
    return jsonError("Raw point queries are only available at high zoom.", 400);
  }

  const points = await listAtlasPoints(parsed.value);
  return Response.json({
    lod: "points",
    view: parsed.value.view,
    bbox: parsed.value.bbox,
    count: points.length,
    limit: parsed.value.limit,
    points,
  });
}
