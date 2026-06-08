import type { BenchmarkContext, CheckResult, ValidatorResult } from "../types";
import { readAppSource, readAtlasReactSource } from "../monorepoPaths.js";
import { hasPackage, pass, skip, warn } from "./helpers";

export async function memoryValidator(
  _context: BenchmarkContext,
): Promise<ValidatorResult> {
  const results: CheckResult[] = [];
  const canvasSource = readAtlasReactSource("components/atlas/AtlasCanvas.tsx");
  const viewerSource = readAppSource("components/atlas/AtlasViewer.tsx");
  const bufferSource = readAtlasReactSource("lib/atlas/rendering/buffers.ts");

  const animationCleansUp =
    /requestAnimationFrame/.test(canvasSource) &&
    /cancelAnimationFrame/.test(canvasSource) &&
    /return\s+\(\)\s*=>/.test(canvasSource);
  const viewerTimersCleanup =
    /window\.setTimeout/.test(viewerSource) &&
    /window\.clearTimeout/.test(viewerSource);
  const typedArraysIsolated =
    /new Float32Array/.test(bufferSource) &&
    !/new Float32Array/.test(canvasSource);
  const noPerFrameTypedArrayAllocations =
    !/tick[\s\S]{0,700}new\s+(Float32Array|Uint8Array|ArrayBuffer)/.test(canvasSource);

  results.push(
    animationCleansUp
      ? pass(
          "memory-animation-cleanup",
          "memory",
          "Animation frames are cleaned up",
          "AtlasCanvas cancels requestAnimationFrame work during point transition cleanup.",
        )
      : warn(
          "memory-animation-cleanup",
          "memory",
          "Animation frames are cleaned up",
          "AtlasCanvas did not clearly cancel requestAnimationFrame work on cleanup.",
        ),
  );

  results.push(
    viewerTimersCleanup
      ? pass(
          "memory-debounce-cleanup",
          "memory",
          "Debounce timers are cleaned up",
          "AtlasViewer clears viewport debounce timers on effect cleanup.",
        )
      : warn(
          "memory-debounce-cleanup",
          "memory",
          "Debounce timers are cleaned up",
          "AtlasViewer did not clearly clear viewport debounce timers.",
        ),
  );

  results.push(
    typedArraysIsolated && noPerFrameTypedArrayAllocations
      ? pass(
          "memory-typed-array-allocation",
          "memory",
          "Typed-array allocation is isolated",
          "Typed-array helpers live outside React render paths and no per-frame typed-array allocation pattern was detected.",
        )
      : warn(
          "memory-typed-array-allocation",
          "memory",
          "Typed-array allocation is isolated",
          "Potential typed-array allocation inside renderer/frame path detected; inspect before scaling.",
        ),
  );

  results.push(
    hasPackage("@playwright/test")
      ? warn(
          "memory-browser-heap",
          "memory",
          "Browser heap stability",
          "Playwright is installed; add focused browser heap sampling for repeated pan/zoom cycles.",
        )
      : skip(
          "memory-browser-heap",
          "memory",
          "Browser heap stability",
          "Playwright is not installed, so heap growth across repeated interactions is not measured in this local gate.",
        ),
  );

  return { validator: "memory", results };
}
