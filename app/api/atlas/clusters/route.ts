import { getAtlasSourceMode, listAtlasClusters, listAtlasPoints } from "@/lib/atlas/db";
import { ATLAS_LOD_CONFIG } from "@/lib/atlas/lod";
import { jsonError, parseAtlasBboxParams } from "@/lib/atlas/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (getAtlasSourceMode() === "unavailable") {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const parsed = parseAtlasBboxParams(new URL(request.url).searchParams);
  if (!parsed.ok) return jsonError(parsed.error, parsed.status);

  const [clusters, representativePoints] = await Promise.all([
    listAtlasClusters({
      view: parsed.value.view,
      bbox: parsed.value.bbox,
      limit: Math.min(parsed.value.limit, ATLAS_LOD_CONFIG.maxClusters),
    }),
    listAtlasPoints({
      view: parsed.value.view,
      bbox: parsed.value.bbox,
      limit: ATLAS_LOD_CONFIG.maxRepresentativePoints,
    }),
  ]);

  return Response.json({
    lod: "clusters",
    view: parsed.value.view,
    bbox: parsed.value.bbox,
    count: clusters.length,
    clusters,
    representativePoints,
  });
}
