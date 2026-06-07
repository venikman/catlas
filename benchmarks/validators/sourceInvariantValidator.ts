import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ATLAS_LOD_CONFIG } from "../../lib/atlas/lod";
import { ATLAS_RUNTIME_CONFIG } from "../../lib/atlas/runtimeConfig";
import { BUDGETS } from "../budgets";
import type { BenchmarkContext, ValidatorResult } from "../types";
import { fail, pass, readSourceMap, warn } from "./helpers";

type SourceInvariant = {
  detail: string;
  id: string;
  label: string;
  severity: "error" | "warn";
  ok: boolean;
};

export function scanSourceInvariants(root = process.cwd()): SourceInvariant[] {
  const source = readSourceMap(root, ["app", "components", "lib"]);
  const appApi = Array.from(source.entries()).filter(([file]) =>
    file.startsWith("app/api/atlas/"),
  );
  const clientComponents = Array.from(source.entries()).filter(([file]) =>
    file.startsWith("components/"),
  );
  const atlasCanvas = source.get("components/atlas/AtlasCanvas.tsx") ?? "";
  const fetchApi = source.get("lib/atlas/api.ts") ?? "";
  const lodConfig = source.get("lib/atlas/lod.ts") ?? "";
  const responseShaping = source.get("lib/atlas/responseShaping.ts") ?? "";
  const pointsRoute = source.get("app/api/atlas/points/route.ts") ?? "";

  const clientImportsDb = clientComponents.some(([, text]) =>
    /from\s+["']@\/lib\/atlas\/db["']/.test(text),
  );
  const hardcodedFetchThresholds =
    /input\.zoom\s*<\s*3/.test(fetchApi) || /input\.zoom\s*<\s*6\.01/.test(fetchApi);
  const routeHasLowZoomGuard = /shouldFetchPoints/.test(pointsRoute);
  const routeHasBboxValidation = /parseAtlasBboxParams/.test(pointsRoute);
  const routeHasLightweightPoint = /lightweightPoints/.test(pointsRoute);
  const shapingStripsMetadata =
    /lightweightPoint/.test(responseShaping) &&
    !/metadata:\s*point\.metadata/.test(responseShaping) &&
    !/payloadSummary:\s*point\.payloadSummary/.test(responseShaping);
  const runtimeConfigExists = existsSync(join(root, "lib/atlas/runtimeConfig.ts"));
  const visualConfigExists = existsSync(join(root, "lib/atlas/visualConfig.ts"));
  const lodConfigCentral =
    /ATLAS_LOD_CONFIG/.test(lodConfig) && /getLodForZoom/.test(lodConfig);
  const searchCapBounded =
    ATLAS_LOD_CONFIG.maxSearchResults <= BUDGETS.bounds.maxSearchResults &&
    ATLAS_RUNTIME_CONFIG.limits.maxSearchResults <= BUDGETS.bounds.maxSearchResults;
  const hasPerPointSvgMap = /renderedPoints\.map/.test(atlasCanvas);
  const hasCanvasDataTestId = /data-testid="atlas-canvas"/.test(atlasCanvas);
  const consoleSpam = appApi.some(([, text]) => /console\.log\(/.test(text));

  return [
    {
      detail: clientImportsDb
        ? "Client components import server database code."
        : "No client component imports lib/atlas/db.",
      id: "client-no-db-import",
      label: "Client components do not import database code",
      ok: !clientImportsDb,
      severity: "error",
    },
    {
      detail: hardcodedFetchThresholds
        ? "Client fetch code still hardcodes LOD zoom thresholds."
        : "Client fetch code delegates LOD endpoint selection to shared LOD config.",
      id: "lod-thresholds-centralized",
      label: "LOD thresholds are centralized",
      ok: !hardcodedFetchThresholds,
      severity: "error",
    },
    {
      detail: routeHasLowZoomGuard
        ? "Points route rejects requests below high zoom."
        : "Points route is missing shouldFetchPoints guard.",
      id: "points-low-zoom-guard",
      label: "Raw point endpoint rejects low zoom",
      ok: routeHasLowZoomGuard,
      severity: "error",
    },
    {
      detail: routeHasBboxValidation
        ? "Points route validates bbox parameters before querying."
        : "Points route does not call parseAtlasBboxParams.",
      id: "points-bbox-validation",
      label: "Raw point endpoint requires bbox validation",
      ok: routeHasBboxValidation,
      severity: "error",
    },
    {
      detail: routeHasLightweightPoint && shapingStripsMetadata
        ? "Bulk point route uses lightweight point shaping and does not return metadata."
        : "Bulk point route may return heavy metadata.",
      id: "points-no-bulk-metadata",
      label: "Bulk point payload excludes heavy metadata",
      ok: routeHasLightweightPoint && shapingStripsMetadata,
      severity: "error",
    },
    {
      detail: runtimeConfigExists
        ? "Runtime limits and cache TTLs are centralized."
        : "Runtime config file is missing.",
      id: "runtime-config-centralized",
      label: "Runtime limits are centralized",
      ok: runtimeConfigExists,
      severity: "error",
    },
    {
      detail: visualConfigExists
        ? "Visual settings are centralized."
        : "Visual config file is missing.",
      id: "visual-config-centralized",
      label: "Visual config is centralized",
      ok: visualConfigExists,
      severity: "warn",
    },
    {
      detail: lodConfigCentral
        ? "LOD config exports thresholds and selection helper."
        : "LOD config is missing thresholds or getLodForZoom.",
      id: "lod-config-central",
      label: "LOD config has single source of truth",
      ok: lodConfigCentral,
      severity: "error",
    },
    {
      detail: searchCapBounded
        ? `Search cap is ${ATLAS_RUNTIME_CONFIG.limits.maxSearchResults}, within benchmark limit ${BUDGETS.bounds.maxSearchResults}.`
        : `Search cap is ${ATLAS_RUNTIME_CONFIG.limits.maxSearchResults}, above benchmark limit ${BUDGETS.bounds.maxSearchResults}.`,
      id: "search-cap-bounded",
      label: "Search response cap is bounded",
      ok: searchCapBounded,
      severity: "error",
    },
    {
      detail: hasPerPointSvgMap
        ? "Current no-WebGL SVG renderer maps bounded points to SVG circles; acceptable only under strict caps."
        : "Main atlas renderer does not map points to React elements.",
      id: "renderer-point-elements",
      label: "Renderer avoids unbounded React point elements",
      ok: !hasPerPointSvgMap,
      severity: "warn",
    },
    {
      detail: hasCanvasDataTestId
        ? "Atlas canvas exposes a stable test id for runtime benchmarks."
        : "Atlas canvas is missing data-testid=atlas-canvas.",
      id: "runtime-test-hook",
      label: "Renderer has stable benchmark hook",
      ok: hasCanvasDataTestId,
      severity: "warn",
    },
    {
      detail: consoleSpam
        ? "API routes contain console.log calls."
        : "API routes do not contain console.log spam.",
      id: "no-console-spam",
      label: "No console.log spam in API routes",
      ok: !consoleSpam,
      severity: "warn",
    },
  ];
}

export async function sourceInvariantValidator(
  _context: BenchmarkContext,
): Promise<ValidatorResult> {
  const invariants = scanSourceInvariants();
  return {
    validator: "sourceInvariant",
    results: invariants.map((invariant) => {
      if (invariant.ok) {
        return pass(invariant.id, "architecture", invariant.label, invariant.detail, {
          severity: invariant.severity,
        });
      }
      if (invariant.severity === "warn") {
        return warn(invariant.id, "architecture", invariant.label, invariant.detail);
      }
      return fail(invariant.id, "architecture", invariant.label, invariant.detail);
    }),
  };
}
