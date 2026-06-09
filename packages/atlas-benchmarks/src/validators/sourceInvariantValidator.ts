import { existsSync } from "node:fs";
import { join } from "node:path";
import { ATLAS_LOD_CONFIG } from "@catlas/atlas-react/lod";
import { ATLAS_RUNTIME_CONFIG } from "../atlas/runtimeConfig.js";
import { BUDGETS } from "../budgets";
import { appRoot, atlasReactSourceRoot } from "../monorepoPaths.js";
import type { BenchmarkContext, ValidatorResult } from "../types";
import { fail, pass, readSourceMap, warn } from "./helpers";

const DOC_BASE = "docs/adoption/benchmark-interpretation.md";

type SourceInvariant = {
  detail: string;
  id: string;
  label: string;
  severity: "error" | "warn";
  ok: boolean;
  rationale?: string;
  fix?: string;
  docRef?: string;
  loadBearing?: boolean;
};

export function scanSourceInvariants(root = appRoot()): SourceInvariant[] {
  const source = readSourceMap(root, ["app", "components", "lib"]);
  const appApi = Array.from(source.entries()).filter(([file]) =>
    file.startsWith("app/api/atlas/"),
  );
  const clientComponents = Array.from(source.entries()).filter(([file]) =>
    file.startsWith("components/"),
  );
  const atlasCanvas =
    source.get("components/atlas/AtlasCanvas.tsx") ??
    readSourceMap(atlasReactSourceRoot(), ["components/atlas"]).get(
      "components/atlas/AtlasCanvas.tsx",
    ) ??
    "";
  const fetchApi = source.get("lib/atlas/api.ts") ?? "";
  const lodConfig =
    readSourceMap(atlasReactSourceRoot(), ["lib/atlas"]).get("lib/atlas/lod.ts") ?? "";
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
  const visualConfigExists =
    existsSync(join(root, "lib/atlas/visualConfig.ts")) ||
    existsSync(join(atlasReactSourceRoot(), "lib/atlas/visualConfig.ts"));
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
      docRef: `${DOC_BASE}#client-no-db-import`,
      fix: "Move database access behind server routes/actions in lib/atlas/db and import only DTOs into client components.",
      id: "client-no-db-import",
      label: "Client components do not import database code",
      loadBearing: true,
      ok: !clientImportsDb,
      rationale:
        "Importing server database code into client components leaks credentials and bundles Node-only modules into the browser.",
      severity: "error",
    },
    {
      detail: hardcodedFetchThresholds
        ? "Client fetch code still hardcodes LOD zoom thresholds."
        : "Client fetch code delegates LOD endpoint selection to shared LOD config.",
      docRef: `${DOC_BASE}#lod-thresholds-centralized`,
      fix: "Replace hardcoded zoom comparisons in lib/atlas/api.ts with getLodForZoom/shouldFetchPoints from the shared LOD config.",
      id: "lod-thresholds-centralized",
      label: "LOD thresholds are centralized",
      loadBearing: true,
      ok: !hardcodedFetchThresholds,
      rationale:
        "Duplicated zoom thresholds drift from the shared LOD config and silently fetch the wrong layer, breaking boundedness guarantees.",
      severity: "error",
    },
    {
      detail: routeHasLowZoomGuard
        ? "Points route rejects requests below high zoom."
        : "Points route is missing shouldFetchPoints guard.",
      docRef: `${DOC_BASE}#points-low-zoom-guard`,
      fix: "Call shouldFetchPoints at the top of app/api/atlas/points/route.ts and return 400 when it is false.",
      id: "points-low-zoom-guard",
      label: "Raw point endpoint rejects low zoom",
      loadBearing: true,
      ok: routeHasLowZoomGuard,
      rationale:
        "Without a low-zoom guard the raw points endpoint can stream the entire dataset, blowing the payload hard cap and freezing the renderer.",
      severity: "error",
    },
    {
      detail: routeHasBboxValidation
        ? "Points route validates bbox parameters before querying."
        : "Points route does not call parseAtlasBboxParams.",
      docRef: `${DOC_BASE}#points-bbox-validation`,
      fix: "Parse and clamp the viewport with parseAtlasBboxParams before issuing the points query in route.ts.",
      id: "points-bbox-validation",
      label: "Raw point endpoint requires bbox validation",
      loadBearing: true,
      ok: routeHasBboxValidation,
      rationale:
        "An unvalidated bbox lets a client request an unbounded region, defeating the per-response point cap and risking a full table scan.",
      severity: "error",
    },
    {
      detail: routeHasLightweightPoint && shapingStripsMetadata
        ? "Bulk point route uses lightweight point shaping and does not return metadata."
        : "Bulk point route may return heavy metadata.",
      docRef: `${DOC_BASE}#points-no-bulk-metadata`,
      fix: "Shape bulk rows through lightweightPoint in lib/atlas/responseShaping.ts so metadata and payloadSummary are dropped.",
      id: "points-no-bulk-metadata",
      label: "Bulk point payload excludes heavy metadata",
      loadBearing: true,
      ok: routeHasLightweightPoint && shapingStripsMetadata,
      rationale:
        "Returning per-point metadata in bulk responses multiplies payload size and pushes the points endpoint past its hard cap.",
      severity: "error",
    },
    {
      detail: runtimeConfigExists
        ? "Runtime limits and cache TTLs are centralized."
        : "Runtime config file is missing.",
      docRef: `${DOC_BASE}#runtime-config-centralized`,
      fix: "Create lib/atlas/runtimeConfig.ts and source response limits and cache TTLs from it instead of inline literals.",
      id: "runtime-config-centralized",
      label: "Runtime limits are centralized",
      loadBearing: true,
      ok: runtimeConfigExists,
      rationale:
        "Scattered runtime limits cannot be reasoned about or enforced; a single config is required for the benchmark to assert bounded behavior.",
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
      docRef: `${DOC_BASE}#lod-config-central`,
      fix: "Export ATLAS_LOD_CONFIG and getLodForZoom from lib/atlas/lod.ts and consume them everywhere LOD is decided.",
      id: "lod-config-central",
      label: "LOD config has single source of truth",
      loadBearing: true,
      ok: lodConfigCentral,
      rationale:
        "If the LOD thresholds and selection helper are not centralized, server and client can disagree on which layer to serve, breaking boundedness.",
      severity: "error",
    },
    {
      detail: searchCapBounded
        ? `Search cap is ${ATLAS_RUNTIME_CONFIG.limits.maxSearchResults}, within benchmark limit ${BUDGETS.bounds.maxSearchResults}.`
        : `Search cap is ${ATLAS_RUNTIME_CONFIG.limits.maxSearchResults}, above benchmark limit ${BUDGETS.bounds.maxSearchResults}.`,
      docRef: `${DOC_BASE}#search-cap-bounded`,
      fix: `Lower maxSearchResults in the LOD and runtime config to at most ${BUDGETS.bounds.maxSearchResults}.`,
      id: "search-cap-bounded",
      label: "Search response cap is bounded",
      loadBearing: true,
      ok: searchCapBounded,
      rationale:
        "An unbounded search cap lets a single query return arbitrarily many rows, blowing payload and render budgets.",
      severity: "error",
    },
    {
      detail: hasPerPointSvgMap
        ? "Renderer maps bounded points to SVG circles; keep strict caps or move them to Canvas 2D."
        : "Main atlas renderer does not map points to React elements.",
      docRef: `${DOC_BASE}#renderer-point-elements`,
      fix: "Render points into the Canvas 2D texture (or a tiled/binary layer) instead of mapping each point to an SVG element.",
      id: "renderer-point-elements",
      label: "Renderer avoids unbounded React point elements",
      loadBearing: true,
      ok: !hasPerPointSvgMap,
      rationale:
        "One React/SVG element per point makes the DOM grow with dataset size and stalls the main thread at high zoom.",
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
      const teach = {
        docRef: invariant.docRef,
        fix: invariant.fix,
        loadBearing: invariant.loadBearing,
        rationale: invariant.rationale,
      };
      if (invariant.ok) {
        return pass(invariant.id, "architecture", invariant.label, invariant.detail, {
          ...teach,
          severity: invariant.severity,
        });
      }
      if (invariant.severity === "warn") {
        return warn(invariant.id, "architecture", invariant.label, invariant.detail, teach);
      }
      return fail(invariant.id, "architecture", invariant.label, invariant.detail, teach);
    }),
  };
}
