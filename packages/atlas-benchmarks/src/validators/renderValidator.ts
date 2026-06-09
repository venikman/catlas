import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ATLAS_BUDGETS, BUDGETS } from "../budgets";
import {
  atlasReactSourceRoot,
  readAppSource,
  readAtlasReactSource,
} from "../monorepoPaths.js";
import { scenarioUrl } from "../scenarios";
import type { BenchmarkContext, CheckResult, ValidatorResult } from "../types";
import {
  fail,
  hasPackage,
  isServerReachable,
  pass,
  skip,
  tryFetchJson,
  warn,
} from "./helpers";

const DOC_BASE = "docs/adoption/benchmark-interpretation.md";

const CONSOLE_ERRORS_TEACH = {
  docRef: `${DOC_BASE}#render-browser-console-errors`,
  fix: "Open the page, reproduce the console errors, and fix the throwing component or failing fetch before treating renders as trustworthy.",
  loadBearing: true,
  rationale:
    "Browser console errors mean the renderer threw at runtime; any screenshot or measurement taken afterwards is unreliable.",
} as const;

const CONSOLE_WARNINGS_TEACH = {
  docRef: `${DOC_BASE}#render-browser-console-warnings`,
  fix: "Triage the captured warnings (hydration, keys, deprecations) before using screenshots as visual baselines.",
  rationale:
    "Console warnings often precede subtle visual regressions, but they do not by themselves invalidate the render, so this is advisory.",
} as const;

const NO_POINTS_FETCH_TEACH = {
  docRef: `${DOC_BASE}#render-initial-no-points-fetch`,
  fix: "Gate the initial fetch behind shouldFetchPoints so the first paint never calls /api/atlas/points.",
  loadBearing: true,
  rationale:
    "Calling the raw points endpoint on initial load can stream the whole dataset before the user zooms in, breaking the cold-start budget and boundedness.",
} as const;

async function browserRuntimeChecks(
  baseUrl: string,
): Promise<CheckResult[]> {
  if (!(await isServerReachable(baseUrl))) {
    return [
      skip(
        "render-browser-runtime",
        "render",
        "Browser runtime console capture",
        `Server not reachable at ${baseUrl}; browser console and network checks were not measured.`,
      ),
    ];
  }

  if (!hasPackage("playwright")) {
    return [
      skip(
        "render-browser-runtime",
        "render",
        "Browser runtime console capture",
        "Playwright is not installed; browser console and network checks were not measured.",
      ),
    ];
  }

  const { chromium } = await import("playwright");
  const candidates: NonNullable<Parameters<typeof chromium.launch>[0]>[] = [
    { channel: process.env.BENCH_BROWSER_CHANNEL ?? "chrome", headless: true },
    { headless: true },
  ];
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  let launchError = "";

  for (const options of candidates) {
    try {
      browser = await chromium.launch(options);
      break;
    } catch (error) {
      launchError = error instanceof Error ? error.message : String(error);
    }
  }

  if (!browser) {
    return [
      skip(
        "render-browser-runtime",
        "render",
        "Browser runtime console capture",
        `Playwright is installed, but no browser launched. Last error: ${launchError}`,
      ),
    ];
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const failedRequests: string[] = [];
  const failedResponses: string[] = [];
  const atlasRequests: string[] = [];
  const atlasResponseSizePromises: Array<
    Promise<{ bytes: number; path: string; status: number }>
  > = [];
  const startedAt = performance.now();

  try {
    const page = await browser.newPage({ viewport: { height: 900, width: 1440 } });
    await page.route("**/favicon.ico", (route) =>
      route.fulfill({ body: "", status: 204 }),
    );
    page.on("console", (message) => {
      const text = message.text();
      if (message.type() === "error") errors.push(text);
      if (message.type() === "warning") warnings.push(text);
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("/api/atlas/")) atlasRequests.push(new URL(url).pathname);
    });
    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`);
    });
    page.on("response", (response) => {
      const url = response.url();
      if (url.includes("/api/atlas/")) {
        const path = new URL(url).pathname;
        if (response.status() >= 400) {
          failedResponses.push(`${response.status()} ${url}`);
        }
        atlasResponseSizePromises.push(
          response
            .body()
            .then((body) => ({
              bytes: body.byteLength,
              path,
              status: response.status(),
            }))
            .catch(() => ({ bytes: 0, path, status: response.status() })),
        );
      }
    });

    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator('[data-testid="atlas-root"]').waitFor({ timeout: 15000 });
    const mapCanvas = page.locator('[data-testid="atlas-map-canvas"]');
    const mapSvg = page.locator('[data-testid="atlas-overlay"]');
    // Canvas texture is aria-hidden by design; attached + bounding box checks replace visible waits.
    await mapCanvas.waitFor({ timeout: 15000, state: "attached" });
    await mapSvg.waitFor({ timeout: 15000, state: "attached" });
    await page.waitForTimeout(350);

    const rootReadyMs = Number((performance.now() - startedAt).toFixed(2));
    const svgBox = await mapSvg.boundingBox();
    const canvasBox = await mapCanvas.boundingBox();
    const canvasHasInk = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        '[data-testid="atlas-map-canvas"]',
      );
      const context = canvas?.getContext("2d");
      if (!canvas || !context || canvas.width <= 0 || canvas.height <= 0) return false;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] > 0) return true;
      }
      return false;
    });
    const pointRequests = atlasRequests.filter((path) => path === "/api/atlas/points");
    const atlasResponseSizes = await Promise.all(atlasResponseSizePromises);
    const initialAtlasPayloadBytes = atlasResponseSizes.reduce(
      (total, response) => total + response.bytes,
      0,
    );

    return [
      pass(
        "render-browser-runtime",
        "render",
        "Browser runtime console capture",
        `Captured browser runtime for ${rootReadyMs} ms with ${atlasRequests.length} atlas API requests.`,
        {
          budget: BUDGETS.webVitals.coldStartMs,
          comparison: "lte",
          measured: rootReadyMs,
          severity: "warn",
          sotaBudget: ATLAS_BUDGETS.coldStart.firstMeaningfulAtlasRenderMs.sota,
          unit: "ms",
        },
      ),
      errors.length === 0
        ? pass(
            "render-browser-console-errors",
            "render",
            "No browser console errors",
            "Captured 0 browser console errors and page errors.",
            CONSOLE_ERRORS_TEACH,
          )
        : fail(
            "render-browser-console-errors",
            "render",
            "No browser console errors",
            `Captured ${errors.length} browser errors: ${errors.slice(0, 3).join(" | ")}`,
            CONSOLE_ERRORS_TEACH,
          ),
      warnings.length === 0
        ? pass(
            "render-browser-console-warnings",
            "render",
            "Browser console warnings captured",
            "Captured 0 browser console warnings.",
            { ...CONSOLE_WARNINGS_TEACH, severity: "warn" },
          )
        : warn(
            "render-browser-console-warnings",
            "render",
            "Browser console warnings captured",
            `Captured ${warnings.length} browser warnings: ${warnings.slice(0, 3).join(" | ")}`,
            CONSOLE_WARNINGS_TEACH,
          ),
      failedRequests.length === 0 && failedResponses.length === 0
        ? pass(
            "render-browser-network",
            "render",
            "No failed browser network requests",
            "Captured 0 failed browser network requests and 0 failed atlas API responses.",
          )
        : fail(
            "render-browser-network",
            "render",
            "No failed browser network requests",
            `Captured ${failedRequests.length} failed requests and ${failedResponses.length} failed atlas API responses: ${[
              ...failedRequests,
              ...failedResponses,
            ]
              .slice(0, 3)
              .join(" | ")}`,
          ),
      pointRequests.length === 0
        ? pass(
            "render-initial-no-points-fetch",
            "render",
            "Initial load avoids raw points endpoint",
            "Initial browser load did not call /api/atlas/points.",
            NO_POINTS_FETCH_TEACH,
          )
        : fail(
            "render-initial-no-points-fetch",
            "render",
            "Initial load avoids raw points endpoint",
            `Initial browser load called /api/atlas/points ${pointRequests.length} times.`,
            NO_POINTS_FETCH_TEACH,
          ),
      initialAtlasPayloadBytes <= BUDGETS.hardCaps.initialAtlasPayloadBytes
        ? initialAtlasPayloadBytes <= BUDGETS.payloadBytes.initialSoftTarget
          ? pass(
              "render-initial-atlas-payload",
              "render",
              "Initial atlas API payload is bounded",
              `Initial atlas API payload was ${initialAtlasPayloadBytes} bytes across ${atlasResponseSizes.length} responses.`,
              {
                budget: BUDGETS.payloadBytes.initialSoftTarget,
                comparison: "lte",
                measured: initialAtlasPayloadBytes,
                severity: "warn",
                sotaBudget: ATLAS_BUDGETS.payloadBytes.initialAtlas.sota,
                unit: "bytes",
              },
            )
          : warn(
              "render-initial-atlas-payload",
              "render",
              "Initial atlas API payload is bounded",
              `Initial atlas API payload was ${initialAtlasPayloadBytes} bytes, above good target ${BUDGETS.payloadBytes.initialSoftTarget}.`,
              {
                budget: BUDGETS.payloadBytes.initialSoftTarget,
                comparison: "lte",
                measured: initialAtlasPayloadBytes,
                sotaBudget: ATLAS_BUDGETS.payloadBytes.initialAtlas.sota,
                unit: "bytes",
              },
            )
        : fail(
            "render-initial-atlas-payload",
            "render",
            "Initial atlas API payload is bounded",
            `Initial atlas API payload was ${initialAtlasPayloadBytes} bytes, above hard cap ${BUDGETS.hardCaps.initialAtlasPayloadBytes}.`,
            {
              budget: BUDGETS.hardCaps.initialAtlasPayloadBytes,
              comparison: "lte",
              measured: initialAtlasPayloadBytes,
              sotaBudget: ATLAS_BUDGETS.payloadBytes.initialAtlas.sota,
              unit: "bytes",
            },
          ),
      canvasBox && canvasBox.width > 0 && canvasBox.height > 0 && svgBox && svgBox.width > 0 && svgBox.height > 0
        ? pass(
            "render-browser-nonblank-shell",
            "render",
            "Atlas renderer has visible bounds",
            `Canvas bounds were ${Math.round(canvasBox.width)}x${Math.round(canvasBox.height)} px; SVG overlay bounds were ${Math.round(svgBox.width)}x${Math.round(svgBox.height)} px.`,
          )
        : fail(
            "render-browser-nonblank-shell",
            "render",
            "Atlas renderer has visible bounds",
            "Canvas or SVG renderer bounds were missing or zero-sized.",
          ),
      canvasHasInk
        ? pass(
            "render-canvas-nonblank-texture",
            "render",
            "Canvas map texture is nonblank",
            "Canvas 2D map texture contained nontransparent pixels.",
          )
        : fail(
            "render-canvas-nonblank-texture",
            "render",
            "Canvas map texture is nonblank",
            "Canvas 2D map texture was blank.",
          ),
    ];
  } finally {
    await browser.close();
  }
}

export async function renderValidator(
  context: BenchmarkContext,
): Promise<ValidatorResult> {
  const results: CheckResult[] = [];
  const canvasSource = readAtlasReactSource("components/atlas/AtlasCanvas.tsx");
  const viewerSource = readAppSource("components/atlas/AtlasViewer.tsx");
  const noWebglTestSource = readFileSync(
    join(atlasReactSourceRoot(), "../tests/noWebglRenderer.test.ts"),
    "utf8",
  );

  const hasCanvas2DRenderer =
    /<canvas\b/.test(canvasSource) && /getContext\(\s*["']2d/.test(canvasSource);
  const hasSvgRenderer = /<svg[\s>]/.test(canvasSource);
  const hasStableRootHooks =
    /data-testid="atlas-root"/.test(viewerSource) &&
    /data-testid="atlas-canvas"/.test(canvasSource);
  const noWebglReferences =
    !/(WEBGL_debug_renderer_info|createContext\(\s*["']webgl|getContext\(\s*["']webgl|DeckGL|@deck\.gl)/i.test(
      `${canvasSource}\n${viewerSource}`,
    );
  const noWebglRegressionTest = /no-WebGL atlas renderer/.test(noWebglTestSource);

  results.push(
    hasCanvas2DRenderer && hasSvgRenderer
      ? pass(
          "render-svg-initializes",
          "render",
          "Renderer initializes without WebGL",
          "AtlasCanvas contains a Canvas 2D map texture layer and SVG overlay without WebGL.",
        )
      : warn(
          "render-svg-initializes",
          "render",
          "Renderer initializes without WebGL",
          "AtlasCanvas did not contain both the Canvas 2D texture layer and SVG overlay; update this validator for the active renderer.",
        ),
  );

  results.push(
    noWebglReferences
      ? pass(
          "render-no-webgl-runtime",
          "render",
          "No WebGL runtime path",
          "Renderer source does not reference WebGL, deck.gl, or WEBGL_debug_renderer_info.",
        )
      : warn(
          "render-no-webgl-runtime",
          "render",
          "No WebGL runtime path",
          "Renderer source contains WebGL/deck.gl references; verify this is intentional.",
        ),
  );

  results.push(
    noWebglRegressionTest
      ? pass(
          "render-no-webgl-regression-test",
          "render",
          "No-WebGL regression test exists",
          "tests/atlas/noWebglRenderer.test.ts guards against WebGL/deck.gl while allowing Canvas 2D.",
        )
      : warn(
          "render-no-webgl-regression-test",
          "render",
          "No-WebGL regression test exists",
          "No no-WebGL renderer regression test was found.",
        ),
  );

  results.push(
    hasStableRootHooks
      ? pass(
          "render-test-hooks",
          "render",
          "Runtime test hooks are present",
          "atlas-root and atlas-canvas data-testid hooks are present.",
        )
      : warn(
          "render-test-hooks",
          "render",
          "Runtime test hooks are present",
          "atlas-root or atlas-canvas data-testid hook is missing.",
        ),
  );

  if (await isServerReachable(context.baseUrl)) {
    const pageStartedAt = performance.now();
    const response = await fetch(context.baseUrl);
    const text = await response.text();
    const pageMs = Number((performance.now() - pageStartedAt).toFixed(2));
    const bytes = Buffer.byteLength(text);
    results.push(
      response.ok
        ? pass(
            "render-page-shell",
            "render",
            "Atlas page shell loads",
            `Page shell returned ${response.status} in ${pageMs} ms; HTML payload ${bytes} bytes.`,
            {
              budget: BUDGETS.payloadBytes.initialSoftTarget,
              comparison: "lte",
              measured: bytes,
              severity: "warn",
              sotaBudget: ATLAS_BUDGETS.payloadBytes.initialAtlas.sota,
              unit: "bytes",
            },
          )
        : warn(
            "render-page-shell",
            "render",
            "Atlas page shell loads",
            `Page shell returned status ${response.status}.`,
          ),
    );

    const points = await tryFetchJson(
      scenarioUrl(context.baseUrl, context.view, {
        bbox: {
          minX: -0.8,
          maxX: 0.8,
          minY: -0.8,
          maxY: 0.8,
        },
        endpoint: "points",
        expectStatus: 200,
        id: "render-high-zoom-bounded",
        label: "High-zoom bounded point set",
        zoom: 7.2,
      }),
    );
    const count = Number(points.body?.count ?? 0);
    results.push(
      count <= BUDGETS.bounds.maxPointsPerResponse
        ? pass(
            "render-bounded-point-set",
            "render",
            "Renderer receives bounded point sets",
            `High-zoom API returned ${count} points for a bounded viewport.`,
            {
              budget: BUDGETS.bounds.maxPointsPerResponse,
              measured: count,
              unit: "points",
            },
          )
        : warn(
            "render-bounded-point-set",
            "render",
            "Renderer receives bounded point sets",
            `High-zoom API returned ${count} points, above renderer cap ${BUDGETS.bounds.maxPointsPerResponse}.`,
            {
              budget: BUDGETS.bounds.maxPointsPerResponse,
              measured: count,
              unit: "points",
            },
          ),
    );
  } else {
    results.push(
      skip(
        "render-runtime-page-skip",
        "render",
        "Atlas page runtime check",
        `Server not reachable at ${context.baseUrl}; static render checks still ran.`,
      ),
    );
  }

  results.push(...(await browserRuntimeChecks(context.baseUrl)));

  return { validator: "render", results };
}
