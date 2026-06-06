import { getAtlasSourceMode, searchAtlas } from "@/lib/atlas/db";
import { jsonError, parseAtlasSearchParams } from "@/lib/atlas/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (getAtlasSourceMode() === "unavailable") {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const parsed = parseAtlasSearchParams(new URL(request.url).searchParams);
  if (!parsed.ok) return jsonError(parsed.error, parsed.status);

  const results = await searchAtlas(parsed.value);
  return Response.json({
    view: parsed.value.view,
    q: parsed.value.q,
    count: results.length,
    results,
  });
}
