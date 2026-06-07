import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BenchmarkContext, CheckResult, ValidatorResult } from "../types";
import { hasPackage, pass, skip, warn } from "./helpers";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

export async function interactionValidator(
  _context: BenchmarkContext,
): Promise<ValidatorResult> {
  const results: CheckResult[] = [];
  const viewerSource = source("components/atlas/AtlasViewer.tsx");
  const canvasSource = source("components/atlas/AtlasCanvas.tsx");
  const apiSource = source("lib/atlas/api.ts");
  const queryKeySource = source("lib/atlas/queryKeys.ts");

  const fetchUsesAbortSignal =
    /signal\?:\s*AbortSignal/.test(apiSource) && /fetch\(url,\s*\{\s*signal\s*\}/.test(apiSource);
  const viewportUsesDebounce = /useDebouncedValue/.test(viewerSource);
  const viewportQueryKeyIncludesBounds =
    /input\.lod/.test(queryKeySource) &&
    /input\.zoomBand/.test(queryKeySource) &&
    /bboxKey\(input\.bbox\)/.test(queryKeySource);
  const hasPanAndZoomHandlers =
    /onWheel=\{handleWheel\}/.test(canvasSource) &&
    /onPointerDown=\{handlePointerDown\}/.test(canvasSource) &&
    /onPointerMove=\{handlePointerMove\}/.test(canvasSource);
  const hasHoverAndClickHandlers =
    /onMouseEnter/.test(canvasSource) &&
    /onClick/.test(canvasSource) &&
    /onSelectPoint/.test(canvasSource);

  results.push(
    fetchUsesAbortSignal
      ? pass(
          "interaction-fetch-abort-signal",
          "interaction",
          "Viewport fetches consume AbortSignal",
          "Client atlas fetch helper accepts and passes AbortSignal to fetch().",
        )
      : warn(
          "interaction-fetch-abort-signal",
          "interaction",
          "Viewport fetches consume AbortSignal",
          "Client atlas fetch helper does not clearly pass AbortSignal to fetch().",
        ),
  );

  results.push(
    viewportUsesDebounce
      ? pass(
          "interaction-viewport-debounce",
          "interaction",
          "Pan/zoom requests are debounced",
          "AtlasViewer debounces viewport state before viewport data fetches.",
        )
      : warn(
          "interaction-viewport-debounce",
          "interaction",
          "Pan/zoom requests are debounced",
          "AtlasViewer does not clearly debounce viewport data fetches.",
        ),
  );

  results.push(
    viewportQueryKeyIncludesBounds
      ? pass(
          "interaction-query-key-bounds",
          "interaction",
          "Viewport query keys include LOD and bbox",
          "Viewport query key includes view, LOD, zoom band, and rounded bbox key.",
        )
      : warn(
          "interaction-query-key-bounds",
          "interaction",
          "Viewport query keys include LOD and bbox",
          "Viewport query key may be missing LOD, zoom band, or bbox dimensions.",
        ),
  );

  results.push(
    hasPanAndZoomHandlers
      ? pass(
          "interaction-pan-zoom-handlers",
          "interaction",
          "Pan and zoom handlers exist",
          "AtlasCanvas exposes wheel and pointer handlers for pan/zoom interaction.",
        )
      : warn(
          "interaction-pan-zoom-handlers",
          "interaction",
          "Pan and zoom handlers exist",
          "AtlasCanvas is missing a wheel or pointer pan handler.",
        ),
  );

  results.push(
    hasHoverAndClickHandlers
      ? pass(
          "interaction-hover-click-handlers",
          "interaction",
          "Hover and click handlers exist",
          "AtlasCanvas exposes hover and click handlers for atlas entities/clusters.",
        )
      : warn(
          "interaction-hover-click-handlers",
          "interaction",
          "Hover and click handlers exist",
          "AtlasCanvas is missing hover or click handlers.",
        ),
  );

  results.push(
    hasPackage("@playwright/test")
      ? warn(
          "interaction-browser-latency",
          "interaction",
          "Browser interaction latency",
          "Playwright is installed; configure the optional browser specs to measure frame and interaction latency.",
        )
      : skip(
          "interaction-browser-latency",
          "interaction",
          "Browser interaction latency",
          "Playwright is not installed, so pan/zoom/hover/click latency is not measured in this local gate.",
        ),
  );

  return { validator: "interaction", results };
}
