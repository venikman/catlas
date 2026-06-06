import { getAtlasSourceMode, listAtlasDensityTiles } from "@/lib/atlas/db";
import { ATLAS_LOD_CONFIG } from "@/lib/atlas/lod";
import { jsonError, parseAtlasBboxParams } from "@/lib/atlas/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (getAtlasSourceMode() === "unavailable") {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const parsed = parseAtlasBboxParams(new URL(request.url).searchParams);
  if (!parsed.ok) return jsonError(parsed.error, parsed.status);

  const tiles = await listAtlasDensityTiles({
    view: parsed.value.view,
    bbox: parsed.value.bbox,
    limit: Math.min(parsed.value.limit, ATLAS_LOD_CONFIG.maxDensityTiles),
  });

  return Response.json({
    lod: "density",
    view: parsed.value.view,
    bbox: parsed.value.bbox,
    count: tiles.length,
    tiles,
  });
}
