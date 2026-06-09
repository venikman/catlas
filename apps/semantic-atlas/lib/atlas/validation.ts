import { z } from "zod";
import { ATLAS_LOD_CONFIG } from "./lod";
import { ATLAS_RUNTIME_CONFIG } from "./runtimeConfig";
import type { ParsedAtlasViewport, ValidationResult } from "./types";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

const numberParam = z.coerce.number().finite();

function value(params: URLSearchParams, key: string): string | null {
  return params.get(key);
}

export function parseAtlasBboxParams(
  params: URLSearchParams,
): ValidationResult<ParsedAtlasViewport> {
  const view = value(params, "view");
  if (!view || !SLUG_PATTERN.test(view)) {
    return { ok: false, status: 400, error: "Invalid or missing view." };
  }

  const parsed = z
    .object({
      zoom: numberParam.min(-10).max(20),
      minX: numberParam,
      maxX: numberParam,
      minY: numberParam,
      maxY: numberParam,
      limit: z.coerce.number().int().positive().optional(),
    })
    .safeParse({
      zoom: value(params, "zoom"),
      minX: value(params, "minX"),
      maxX: value(params, "maxX"),
      minY: value(params, "minY"),
      maxY: value(params, "maxY"),
      limit: value(params, "limit") ?? undefined,
    });

  if (!parsed.success) {
    return { ok: false, status: 400, error: "Invalid viewport query params." };
  }

  const { zoom, minX, maxX, minY, maxY } = parsed.data;
  if (minX >= maxX || minY >= maxY) {
    return { ok: false, status: 400, error: "Invalid bbox bounds." };
  }

  const width = maxX - minX;
  const height = maxY - minY;
  if (
    width > ATLAS_RUNTIME_CONFIG.limits.maxBboxSpan ||
    height > ATLAS_RUNTIME_CONFIG.limits.maxBboxSpan
  ) {
    return { ok: false, status: 400, error: "Bbox is too large." };
  }

  if (
    zoom >= ATLAS_LOD_CONFIG.pointsMinZoom &&
    (width > ATLAS_RUNTIME_CONFIG.limits.maxHighZoomBboxSpan ||
      height > ATLAS_RUNTIME_CONFIG.limits.maxHighZoomBboxSpan)
  ) {
    return { ok: false, status: 400, error: "High zoom bbox is too large." };
  }

  const requestedLimit = parsed.data.limit ?? ATLAS_RUNTIME_CONFIG.limits.maxPoints;
  const limit = Math.min(requestedLimit, ATLAS_RUNTIME_CONFIG.limits.maxPoints);

  return {
    ok: true,
    value: {
      view,
      zoom,
      bbox: { minX, maxX, minY, maxY, width, height },
      limit,
    },
  };
}

export function parseAtlasSearchParams(
  params: URLSearchParams,
): ValidationResult<{ view: string; q: string; limit: number }> {
  const view = value(params, "view");
  if (!view || !SLUG_PATTERN.test(view)) {
    return { ok: false, status: 400, error: "Invalid or missing view." };
  }

  const q = value(params, "q")?.trim() ?? "";
  const minLength = ATLAS_RUNTIME_CONFIG.limits.minSearchQueryLength;
  if (q.length < minLength || q.length > 120) {
    return {
      ok: false,
      status: 400,
      error: `Search query must be ${minLength}-120 characters.`,
    };
  }

  const requestedLimit = Number.parseInt(value(params, "limit") ?? "", 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), ATLAS_RUNTIME_CONFIG.limits.maxSearchResults)
    : ATLAS_RUNTIME_CONFIG.limits.maxSearchResults;

  return { ok: true, value: { view, q, limit } };
}

export function jsonError(error: string, status = 400): Response {
  return Response.json({ error, ok: false, status }, { status });
}
