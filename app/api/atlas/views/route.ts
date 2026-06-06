import { getAtlasSourceMode, getAtlasStats, listAtlasViews } from "@/lib/atlas/db";
import { jsonError } from "@/lib/atlas/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  if (getAtlasSourceMode() === "unavailable") {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const [views, stats] = await Promise.all([listAtlasViews(), getAtlasStats()]);
  return Response.json({ views, stats });
}
