#!/usr/bin/env node

import { createHash } from "node:crypto";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

type UiCheckStatus = "pass" | "warn" | "fail";

type UiCheck = {
  check: string;
  detail: string;
  status: UiCheckStatus;
};

type GraphInteraction = "none" | "pan" | "wheel" | "wheel-pan";

type ImageTextureProfile = {
  background: { blue: number; green: number; red: number };
  cellCount: number;
  cellVariation: number;
  colored: number;
  height: number;
  hueBucketCount: number;
  markCoverage: number;
  markPixels: number;
  occupiedCellCount: number;
  occupiedCellRatio: number;
  samples: number;
  width: number;
};

function arg(name: string, fallback?: string): string | undefined {
  const direct = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  if (direct) return direct.split("=").slice(1).join("=");
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function numberArg(name: string, fallback: number): number {
  const raw = arg(name);
  if (raw === undefined) {
    if (!Number.isFinite(fallback)) {
      throw new Error(`Invalid fallback for --${name}. Expected a number.`);
    }
    return fallback;
  }
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid --${name} value "${raw}". Expected a number.`);
  }
  return parsed;
}

function check(status: UiCheckStatus, checkName: string, detail: string): UiCheck {
  return { check: checkName, detail, status };
}

function printHelp() {
  console.log(`UI graph evaluator

Usage:
  ui-graph-evaluator --url=http://localhost:3000 --root-selector='[data-testid="graph-root"]' --graph-selector='canvas, svg' [options]

Core options:
  --url URL                         Page to evaluate. Defaults to UI_EVAL_URL, ATLAS_BASE_URL, then http://localhost:3002.
  --root-selector SELECTOR          App/root selector that must exist. Defaults to [data-testid="atlas-root"].
  --graph-selector SELECTOR         Graph selector candidates. Defaults to [data-testid="atlas-map-canvas"], canvas, svg.
  --overlay-selector SELECTOR       Optional overlay/label selector that should remain present after interaction.
  --viewport WIDTHxHEIGHT           Browser viewport. Defaults to 1440x900.
  --interaction wheel|pan|wheel-pan|none
                                    Interaction to test. Defaults to wheel.
  --pan-pixels NUMBER               Drag distance used by pan and wheel-pan. Defaults to 180.
  --wait MS                         Wait after load and after interaction. Defaults to 900.
  --gate                            Exit non-zero when fail-level checks are present.

Texture thresholds:
  --min-coverage NUMBER             Minimum sampled non-white coverage before texture is weak. Defaults to 0.012.
  --min-hue-buckets NUMBER          Minimum sampled hue buckets before color variation is weak. Defaults to 3.
  --min-occupied-cells NUMBER       Minimum occupied sampled grid cells before spatial texture is weak. Defaults to 1.
  --min-overlay-count NUMBER        Minimum overlay selector count when --overlay-selector is set. Defaults to 1.
  --strict-texture                  Treat texture threshold misses as fail instead of warn.

Reference comparison:
  --reference-image PATH_OR_URL      Optional local/remote reference image to compare graph texture against.
  --min-reference-score NUMBER       Minimum reference texture score. Defaults to 55.
  --strict-reference                 Treat reference-score misses as fail instead of warn.
                                    Comparison is background-relative for light map surfaces.

Artifacts:
  --artifacts                       Write before.png and after.png.
  --record-video, --video           Write screenshots plus interaction.webm.
  --artifacts-dir DIR               Artifact directory. Defaults to benchmarks/results/ui-evaluator-artifacts.
  --results-dir DIR                 JSON report directory. Defaults to benchmarks/results.
  --browser-executable PATH         Browser binary. Defaults to UI_EVAL_BROWSER_EXECUTABLE or common macOS Chrome/Chromium paths.

Examples:
  ui-graph-evaluator --url=http://localhost:4173 --root-selector='#root' --graph-selector='canvas, svg' --gate
  ui-graph-evaluator --url=http://localhost:4173 --graph-selector='canvas' --strict-texture --min-coverage=0.04 --record-video
  ui-graph-evaluator --url=http://localhost:4173 --interaction=wheel-pan --overlay-selector='svg text' --gate
  ui-graph-evaluator --url=http://localhost:4173 --graph-selector='canvas' --reference-image=./reference-map.png --gate
`);
}

function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function parseViewport(raw: string): { width: number; height: number } {
  const [width, height] = raw.split("x").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`Invalid viewport "${raw}". Use WIDTHxHEIGHT, for example 1440x900.`);
  }
  return { width, height };
}

function parseInteraction(raw: string): GraphInteraction {
  if (raw === "none" || raw === "pan" || raw === "wheel" || raw === "wheel-pan") {
    return raw;
  }
  throw new Error(
    `Invalid --interaction "${raw}". Use none, wheel, pan, or wheel-pan.`,
  );
}

async function performInteraction(input: {
  interaction: GraphInteraction;
  page: import("playwright").Page;
  panPixels: number;
  viewport: { height: number; width: number };
}) {
  const centerX = input.viewport.width / 2;
  const centerY = input.viewport.height / 2;

  if (input.interaction === "none") return;

  if (input.interaction === "wheel" || input.interaction === "wheel-pan") {
    await input.page.mouse.move(centerX, centerY);
    await input.page.mouse.wheel(0, -900);
  }

  if (input.interaction === "pan" || input.interaction === "wheel-pan") {
    await input.page.mouse.move(centerX, centerY);
    await input.page.mouse.down();
    await input.page.mouse.move(
      centerX + input.panPixels,
      centerY + input.panPixels * 0.34,
      { steps: 8 },
    );
    await input.page.mouse.up();
  }
}

async function resolveGraphSelector(
  page: import("playwright").Page,
  graphSelector: string,
): Promise<string> {
  const candidates = graphSelector
    .split(",")
    .map((candidate) => candidate.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const matches = page.locator(candidate);
    const count = await matches.count();
    if (count === 0) continue;
    const box = await matches.first().boundingBox();
    if (box && box.width >= 240 && box.height >= 240) return candidate;
  }

  return candidates[0] ?? graphSelector;
}

async function existingBrowserExecutable(): Promise<string | undefined> {
  const explicit = arg("browser-executable", process.env.UI_EVAL_BROWSER_EXECUTABLE);
  const candidates = [
    explicit,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next browser candidate.
    }
  }

  return undefined;
}

function mimeTypeForImage(source: string): string {
  const lower = source.toLowerCase().split("?")[0] ?? source.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/png";
}

async function loadImageBuffer(source: string): Promise<Buffer> {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Reference image failed to load: ${source} returned ${response.status}.`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  return readFile(source);
}

async function analyzeImageTexture(input: {
  buffer: Buffer;
  page: import("playwright").Page;
  source: string;
}): Promise<ImageTextureProfile> {
  const dataUrl = `data:${mimeTypeForImage(input.source)};base64,${input.buffer.toString("base64")}`;
  await input.page.evaluate("globalThis.__name = (value) => value");
  return input.page.evaluate(async (url) => {
    const __name = <T>(value: T) => value;
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, image.naturalWidth);
    canvas.height = Math.max(1, image.naturalHeight);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not create image analysis canvas.");
    context.drawImage(image, 0, 0);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const { data, height, width } = imageData;
    const totalPixels = width * height;
    const sampleStride = Math.max(1, Math.floor(totalPixels / 120000));

    const borderColors: Array<[number, number, number]> = [];
    const pushBorderPixel = (x: number, y: number) => {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3] ?? 0;
      if (alpha <= 0) return;
      borderColors.push([
        data[index] ?? 255,
        data[index + 1] ?? 255,
        data[index + 2] ?? 255,
      ]);
    };

    const edgeStep = Math.max(1, Math.floor(Math.max(width, height) / 320));
    for (let x = 0; x < width; x += edgeStep) {
      pushBorderPixel(x, 0);
      pushBorderPixel(x, height - 1);
    }
    for (let y = 0; y < height; y += edgeStep) {
      pushBorderPixel(0, y);
      pushBorderPixel(width - 1, y);
    }

    const luma = ([red, green, blue]: [number, number, number]) =>
      red * 0.2126 + green * 0.7152 + blue * 0.0722;
    const lightBorder = borderColors
      .sort((a, b) => luma(b) - luma(a))
      .slice(0, Math.max(1, Math.ceil(borderColors.length * 0.35)));
    const background =
      lightBorder.length > 0
        ? lightBorder.reduce(
            (acc, color) => ({
              red: acc.red + color[0],
              green: acc.green + color[1],
              blue: acc.blue + color[2],
            }),
            { blue: 0, green: 0, red: 0 },
          )
        : { blue: 255, green: 255, red: 255 };
    const backgroundColor = {
      blue: Math.round(background.blue / Math.max(1, lightBorder.length)),
      green: Math.round(background.green / Math.max(1, lightBorder.length)),
      red: Math.round(background.red / Math.max(1, lightBorder.length)),
    };

    const cellColumns = 24;
    const cellRows = 16;
    const cellCounts = Array.from({ length: cellColumns * cellRows }, () => 0);
    const hueBuckets = new Set<number>();
    let colored = 0;
    let markPixels = 0;
    let samples = 0;

    for (let pixel = 0; pixel < totalPixels; pixel += sampleStride) {
      const index = pixel * 4;
      const alpha = data[index + 3] ?? 0;
      const red = data[index] ?? 255;
      const green = data[index + 1] ?? 255;
      const blue = data[index + 2] ?? 255;
      samples += 1;
      if (alpha <= 0) continue;

      const backgroundDistance = Math.hypot(
        red - backgroundColor.red,
        green - backgroundColor.green,
        blue - backgroundColor.blue,
      );
      if (backgroundDistance <= 18) continue;

      markPixels += 1;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      const cellX = Math.min(cellColumns - 1, Math.floor((x / width) * cellColumns));
      const cellY = Math.min(cellRows - 1, Math.floor((y / height) * cellRows));
      cellCounts[cellY * cellColumns + cellX] += 1;

      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      const chroma = max - min;
      if (chroma > 18) {
        let hue = 0;
        if (max === red) hue = ((green - blue) / chroma + (green < blue ? 6 : 0)) * 60;
        else if (max === green) hue = ((blue - red) / chroma + 2) * 60;
        else hue = ((red - green) / chroma + 4) * 60;
        hueBuckets.add(Math.round(hue / 30));
        colored += 1;
      }
    }

    const occupiedCellCount = cellCounts.filter((entry) => entry > 0).length;
    const meanCellCount =
      cellCounts.reduce((total, entry) => total + entry, 0) / cellCounts.length;
    const cellStdDev =
      meanCellCount > 0
        ? Math.sqrt(
            cellCounts.reduce(
              (total, entry) => total + Math.pow(entry - meanCellCount, 2),
              0,
            ) / cellCounts.length,
          )
        : 0;

    return {
      background: backgroundColor,
      cellCount: cellCounts.length,
      cellVariation: meanCellCount > 0 ? cellStdDev / meanCellCount : 0,
      colored,
      height,
      hueBucketCount: hueBuckets.size,
      markCoverage: samples > 0 ? markPixels / samples : 0,
      markPixels,
      occupiedCellCount,
      occupiedCellRatio: occupiedCellCount / cellCounts.length,
      samples,
      width,
    };
  }, dataUrl);
}

function referenceTextureScore(input: {
  reference: ImageTextureProfile;
  target: ImageTextureProfile;
}): { detail: string; score: number } {
  const coverageDelta = Math.abs(
    input.target.markCoverage - input.reference.markCoverage,
  );
  const occupancyDelta = Math.abs(
    input.target.occupiedCellRatio - input.reference.occupiedCellRatio,
  );
  const hueDelta =
    Math.abs(input.target.hueBucketCount - input.reference.hueBucketCount) /
    Math.max(1, input.reference.hueBucketCount);
  const variationDelta = Math.min(
    2,
    Math.abs(input.target.cellVariation - input.reference.cellVariation),
  );
  const score = Math.max(
    0,
    100 -
      coverageDelta * 130 -
      occupancyDelta * 28 -
      hueDelta * 12 -
      variationDelta * 7,
  );
  const detail = [
    `score=${score.toFixed(1)}`,
    `coverage target=${(input.target.markCoverage * 100).toFixed(2)}% reference=${(input.reference.markCoverage * 100).toFixed(2)}%`,
    `occupancy target=${input.target.occupiedCellCount}/${input.target.cellCount} reference=${input.reference.occupiedCellCount}/${input.reference.cellCount}`,
    `hues target=${input.target.hueBucketCount} reference=${input.reference.hueBucketCount}`,
    `variation target=${input.target.cellVariation.toFixed(2)} reference=${input.reference.cellVariation.toFixed(2)}`,
  ].join("; ");

  return { detail, score: Number(score.toFixed(2)) };
}

async function run() {
  if (flag("help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }

  const url =
    arg("url", process.env.UI_EVAL_URL ?? process.env.ATLAS_BASE_URL) ??
    "http://localhost:3002";
  const rootSelector = arg("root-selector", '[data-testid="atlas-root"]')!;
  const graphSelector = arg(
    "graph-selector",
    '[data-testid="atlas-map-canvas"], canvas, svg',
  )!;
  const overlaySelector = arg("overlay-selector");
  const resultsDir = arg("results-dir", "benchmarks/results")!;
  const artifactsDir = arg("artifacts-dir", join(resultsDir, "ui-evaluator-artifacts"))!;
  const viewport = parseViewport(arg("viewport", "1440x900")!);
  const interaction = parseInteraction(arg("interaction", "wheel")!);
  const waitMs = Number.parseInt(arg("wait", "900")!, 10);
  const panPixels = numberArg("pan-pixels", 180);
  const minCoverage = numberArg(
    "min-coverage",
    Number.parseFloat(process.env.UI_EVAL_MIN_COVERAGE ?? "0.012"),
  );
  const minHueBuckets = numberArg(
    "min-hue-buckets",
    Number.parseFloat(process.env.UI_EVAL_MIN_HUE_BUCKETS ?? "3"),
  );
  const minOccupiedCells = numberArg(
    "min-occupied-cells",
    Number.parseFloat(process.env.UI_EVAL_MIN_OCCUPIED_CELLS ?? "1"),
  );
  const minOverlayCount = numberArg("min-overlay-count", 1);
  const weakTextureStatus: UiCheckStatus = flag("strict-texture") ? "fail" : "warn";
  const referenceImage = arg("reference-image");
  const minReferenceScore = numberArg("min-reference-score", 55);
  const weakReferenceStatus: UiCheckStatus = flag("strict-reference") ? "fail" : "warn";
  const writeArtifacts = flag("artifacts") || flag("record-video") || flag("video");
  const recordVideo = flag("record-video") || flag("video");
  const gate = flag("gate");

  if (writeArtifacts) await mkdir(artifactsDir, { recursive: true });
  const executablePath = await existingBrowserExecutable();
  const browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    recordVideo: recordVideo ? { dir: artifactsDir, size: viewport } : undefined,
  });
  const page = await context.newPage();
  const messages: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      messages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => messages.push(`pageerror: ${error.message}`));

  const checks: UiCheck[] = [];
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(waitMs);

  const title = await page.title();
  checks.push(check("pass", "Page loads", `Loaded "${title}" at ${page.url()}.`));

  const rootCount = await page.locator(rootSelector).count();
  checks.push(
    rootCount > 0
      ? check("pass", "Root selector exists", `${rootSelector} matched ${rootCount} node(s).`)
      : check("fail", "Root selector exists", `${rootSelector} matched no nodes.`),
  );

  const resolvedGraphSelector = await resolveGraphSelector(page, graphSelector);
  const graphCount = await page.locator(resolvedGraphSelector).count();
  checks.push(
    graphCount > 0
      ? check(
          "pass",
          "Graph selector exists",
          `${graphSelector} resolved to ${resolvedGraphSelector} with ${graphCount} node(s).`,
        )
      : check("fail", "Graph selector exists", `${graphSelector} matched no nodes.`),
  );

  if (graphCount > 0) {
    const box = await page.locator(resolvedGraphSelector).first().boundingBox();
    checks.push(
      box && box.width >= 240 && box.height >= 240
        ? check(
            "pass",
            "Graph has visible bounds",
            `Graph bounds were ${Math.round(box.width)}x${Math.round(box.height)} px.`,
          )
        : check("fail", "Graph has visible bounds", "Graph bounds were missing or too small."),
    );
  }

  let overlayCountBefore: number | undefined;
  if (overlaySelector) {
    overlayCountBefore = await page.locator(overlaySelector).count();
    checks.push(
      overlayCountBefore >= minOverlayCount
        ? check(
            "pass",
            "Graph overlay exists",
            `${overlaySelector} matched ${overlayCountBefore} node(s); threshold=${minOverlayCount}.`,
          )
        : check(
            "warn",
            "Graph overlay exists",
            `${overlaySelector} matched ${overlayCountBefore} node(s); threshold=${minOverlayCount}.`,
          ),
    );
  }

  let graphElementScreenshot: Buffer | undefined;
  const captureGraphElementScreenshot = async () => {
    if (!graphElementScreenshot) {
      graphElementScreenshot = await page
        .locator(resolvedGraphSelector)
        .first()
        .screenshot();
    }
    return graphElementScreenshot;
  };

  const texture = await page.evaluate((selector) => {
    const node = document.querySelector(selector);
    if (!node) return { kind: "missing" };
    if (node instanceof HTMLCanvasElement) {
      const context = node.getContext("2d");
      if (!context || node.width <= 0 || node.height <= 0) return { kind: "canvas-empty" };
      try {
        const image = context.getImageData(0, 0, node.width, node.height);
        const cellColumns = 24;
        const cellRows = 16;
        const cellCounts = Array.from({ length: cellColumns * cellRows }, () => 0);
        const hueBuckets = new Set<number>();
        let colored = 0;
        let nonTransparent = 0;
        let nonWhite = 0;
        let samples = 0;
        for (let index = 0; index < image.data.length; index += 64) {
          const alpha = image.data[index + 3] ?? 0;
          const red = image.data[index] ?? 255;
          const green = image.data[index + 1] ?? 255;
          const blue = image.data[index + 2] ?? 255;
          samples += 1;
          if (alpha <= 0) continue;
          nonTransparent += 1;
          if (red < 245 || green < 245 || blue < 245) {
            nonWhite += 1;
            const pixelIndex = Math.floor(index / 4);
            const x = pixelIndex % node.width;
            const y = Math.floor(pixelIndex / node.width);
            const cellX = Math.min(cellColumns - 1, Math.floor((x / node.width) * cellColumns));
            const cellY = Math.min(cellRows - 1, Math.floor((y / node.height) * cellRows));
            cellCounts[cellY * cellColumns + cellX] += 1;
          }

          const max = Math.max(red, green, blue);
          const min = Math.min(red, green, blue);
          const chroma = max - min;
          if (chroma > 18) {
            let hue = 0;
            if (max === red) hue = ((green - blue) / chroma + (green < blue ? 6 : 0)) * 60;
            else if (max === green) hue = ((blue - red) / chroma + 2) * 60;
            else hue = ((red - green) / chroma + 4) * 60;
            hueBuckets.add(Math.round(hue / 30));
            colored += 1;
          }
        }
        const occupiedCellCount = cellCounts.filter((entry) => entry > 0).length;
        const meanCellCount =
          cellCounts.reduce((total, entry) => total + entry, 0) / cellCounts.length;
        const cellStdDev =
          meanCellCount > 0
            ? Math.sqrt(
                cellCounts.reduce(
                  (total, entry) => total + Math.pow(entry - meanCellCount, 2),
                  0,
                ) / cellCounts.length,
              )
            : 0;
        return {
          cellCount: cellCounts.length,
          cellVariation: meanCellCount > 0 ? cellStdDev / meanCellCount : 0,
          colored,
          hueBucketCount: hueBuckets.size,
          kind: "canvas",
          nonTransparent,
          nonWhite,
          occupiedCellCount,
          samples,
        };
      } catch (error) {
        return {
          detail: error instanceof Error ? error.message : String(error),
          kind: "canvas-tainted",
        };
      }
    }
    if (node instanceof SVGElement) {
      return { childCount: node.querySelectorAll("*").length, kind: "svg" };
    }
    return { kind: node.nodeName.toLowerCase() };
  }, resolvedGraphSelector);

  if (texture.kind === "canvas") {
    const nonWhite =
      "nonWhite" in texture && typeof texture.nonWhite === "number"
        ? texture.nonWhite
        : 0;
    checks.push(
      nonWhite > 0
        ? check("pass", "Graph texture is nonblank", `Canvas sample had ${nonWhite} non-white pixels.`)
        : check("fail", "Graph texture is nonblank", "Canvas sample was blank or white-only."),
    );
    const samples =
      "samples" in texture && typeof texture.samples === "number" ? texture.samples : 0;
    const colored =
      "colored" in texture && typeof texture.colored === "number" ? texture.colored : 0;
    const hueBucketCount =
      "hueBucketCount" in texture && typeof texture.hueBucketCount === "number"
        ? texture.hueBucketCount
        : 0;
    const occupiedCellCount =
      "occupiedCellCount" in texture && typeof texture.occupiedCellCount === "number"
        ? texture.occupiedCellCount
        : 0;
    const cellCount =
      "cellCount" in texture && typeof texture.cellCount === "number"
        ? texture.cellCount
        : 0;
    const cellVariation =
      "cellVariation" in texture && typeof texture.cellVariation === "number"
        ? texture.cellVariation
        : 0;
    const coverage = samples > 0 ? nonWhite / samples : 0;
    checks.push(
      coverage >= minCoverage
        ? check(
            "pass",
            "Graph texture coverage measured",
            `Non-white coverage was ${(coverage * 100).toFixed(2)}% across ${samples} sampled pixels; threshold=${(minCoverage * 100).toFixed(2)}%.`,
          )
        : check(
            weakTextureStatus,
            "Graph texture coverage measured",
            `Sparse non-white coverage was ${(coverage * 100).toFixed(2)}% across ${samples} sampled pixels; threshold=${(minCoverage * 100).toFixed(2)}%.`,
          ),
    );
    checks.push(
      occupiedCellCount >= minOccupiedCells
        ? check(
            "pass",
            "Graph spatial texture measured",
            `Marks occupied ${occupiedCellCount}/${cellCount} sampled grid cells; threshold=${minOccupiedCells}; variation=${cellVariation.toFixed(2)}.`,
          )
        : check(
            weakTextureStatus,
            "Graph spatial texture measured",
            `Marks occupied ${occupiedCellCount}/${cellCount} sampled grid cells; threshold=${minOccupiedCells}; variation=${cellVariation.toFixed(2)}.`,
          ),
    );
    checks.push(
      hueBucketCount >= minHueBuckets
        ? check(
            "pass",
            "Graph color variation measured",
            `Detected ${hueBucketCount} hue buckets across ${colored} colored sampled pixels; threshold=${minHueBuckets}.`,
          )
        : check(
            weakTextureStatus,
            "Graph color variation measured",
            `Detected ${hueBucketCount} hue bucket(s); threshold=${minHueBuckets}. Monochrome graphs may be valid but less map-like.`,
          ),
    );
  } else if (texture.kind === "svg") {
    const childCount =
      "childCount" in texture && typeof texture.childCount === "number"
        ? texture.childCount
        : 0;
    checks.push(
      childCount > 0
        ? check("pass", "Graph SVG is nonblank", `SVG has ${childCount} child nodes.`)
        : check("fail", "Graph SVG is nonblank", "SVG had no child nodes."),
    );
  } else {
    const screenshotStatus: UiCheckStatus =
      texture.kind === "canvas-tainted" ? "warn" : weakTextureStatus;
    try {
      const screenshotTexture = await analyzeImageTexture({
        buffer: await captureGraphElementScreenshot(),
        page,
        source: "graph-before.png",
      });
      checks.push(
        screenshotTexture.markPixels > 0
          ? check(
              "pass",
              "Graph screenshot texture is nonblank",
              `Graph element screenshot had ${screenshotTexture.markPixels} background-relative mark pixels.`,
            )
          : check(
              screenshotStatus,
              "Graph screenshot texture is nonblank",
              `Graph element screenshot appeared blank; source=${JSON.stringify(texture)}.`,
            ),
      );
      checks.push(
        screenshotTexture.markCoverage >= minCoverage
          ? check(
              "pass",
              "Graph screenshot texture coverage measured",
              `Background-relative coverage was ${(screenshotTexture.markCoverage * 100).toFixed(2)}%; threshold=${(minCoverage * 100).toFixed(2)}%.`,
            )
          : check(
              screenshotStatus,
              "Graph screenshot texture coverage measured",
              `Background-relative coverage was ${(screenshotTexture.markCoverage * 100).toFixed(2)}%; threshold=${(minCoverage * 100).toFixed(2)}%.`,
            ),
      );
      checks.push(
        screenshotTexture.occupiedCellCount >= minOccupiedCells
          ? check(
              "pass",
              "Graph screenshot spatial texture measured",
              `Marks occupied ${screenshotTexture.occupiedCellCount}/${screenshotTexture.cellCount} sampled grid cells; threshold=${minOccupiedCells}.`,
            )
          : check(
              screenshotStatus,
              "Graph screenshot spatial texture measured",
              `Marks occupied ${screenshotTexture.occupiedCellCount}/${screenshotTexture.cellCount} sampled grid cells; threshold=${minOccupiedCells}.`,
            ),
      );
      checks.push(
        screenshotTexture.hueBucketCount >= minHueBuckets
          ? check(
              "pass",
              "Graph screenshot color variation measured",
              `Detected ${screenshotTexture.hueBucketCount} hue buckets across ${screenshotTexture.colored} colored sampled pixels; threshold=${minHueBuckets}.`,
            )
          : check(
              screenshotStatus,
              "Graph screenshot color variation measured",
              `Detected ${screenshotTexture.hueBucketCount} hue bucket(s); threshold=${minHueBuckets}.`,
            ),
      );
    } catch (error) {
      checks.push(
        check(
          screenshotStatus,
          "Graph texture is inspectable",
          `${JSON.stringify(texture)}; screenshot fallback failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
    }
  }

  const before = await page.screenshot({ fullPage: false });
  const artifacts: {
    afterScreenshot?: string;
    beforeScreenshot?: string;
    graphScreenshot?: string;
    video?: string;
  } = {};
  if (writeArtifacts) {
    artifacts.beforeScreenshot = join(artifactsDir, "before.png");
    await writeFile(artifacts.beforeScreenshot, before);
  }

  if (referenceImage && graphCount > 0) {
    const graphScreenshot = await captureGraphElementScreenshot();
    if (writeArtifacts) {
      artifacts.graphScreenshot = join(artifactsDir, "graph-before.png");
      await writeFile(artifacts.graphScreenshot, graphScreenshot);
    }

    const referenceBuffer = await loadImageBuffer(referenceImage);
    checks.push(
      check(
        "pass",
        "Reference image loads",
        `Loaded ${referenceImage} (${referenceBuffer.length.toLocaleString()} bytes).`,
      ),
    );
    const [targetProfile, referenceProfile] = await Promise.all([
      analyzeImageTexture({
        buffer: graphScreenshot,
        page,
        source: "graph-before.png",
      }),
      analyzeImageTexture({
        buffer: referenceBuffer,
        page,
        source: referenceImage,
      }),
    ]);
    const comparison = referenceTextureScore({
      reference: referenceProfile,
      target: targetProfile,
    });
    checks.push(
      comparison.score >= minReferenceScore
        ? check(
            "pass",
            "Graph reference texture similarity",
            `${comparison.detail}; threshold=${minReferenceScore.toFixed(1)}.`,
          )
        : check(
            weakReferenceStatus,
            "Graph reference texture similarity",
            `${comparison.detail}; threshold=${minReferenceScore.toFixed(1)}.`,
          ),
    );
  }

  await performInteraction({ interaction, page, panPixels, viewport });
  await page.waitForTimeout(waitMs);
  const after = await page.screenshot({ fullPage: false });
  if (writeArtifacts) {
    artifacts.afterScreenshot = join(artifactsDir, "after.png");
    await writeFile(artifacts.afterScreenshot, after);
  }
  const changed = hashBuffer(before) !== hashBuffer(after);
  checks.push(
    interaction === "none"
      ? check("warn", "Graph interaction changes view", "Interaction disabled.")
      : changed
        ? check("pass", "Graph interaction changes view", `${interaction} changed the viewport screenshot.`)
        : check("warn", "Graph interaction changes view", `${interaction} did not change the viewport screenshot.`),
  );

  if (overlaySelector) {
    const overlayCountAfter = await page.locator(overlaySelector).count();
    checks.push(
      overlayCountAfter >= minOverlayCount
        ? check(
            "pass",
            "Graph overlay persists",
            `${overlaySelector} matched ${overlayCountAfter} node(s) after ${interaction}; before=${overlayCountBefore ?? "n/a"} threshold=${minOverlayCount}.`,
          )
        : check(
            "warn",
            "Graph overlay persists",
            `${overlaySelector} matched ${overlayCountAfter} node(s) after ${interaction}; before=${overlayCountBefore ?? "n/a"} threshold=${minOverlayCount}.`,
          ),
    );
  }

  checks.push(
    messages.length === 0
      ? check("pass", "Console health", "No console warnings/errors or page errors.")
      : check("fail", "Console health", messages.slice(0, 8).join("; ")),
  );

  const video = page.video();
  await context.close();
  await browser.close();
  if (video) {
    artifacts.video = join(artifactsDir, "interaction.webm");
    await rename(await video.path(), artifacts.video);
  }

  const summary = {
    fail: checks.filter((entry) => entry.status === "fail").length,
    pass: checks.filter((entry) => entry.status === "pass").length,
    warn: checks.filter((entry) => entry.status === "warn").length,
  };
  const report = {
    checks,
    meta: {
      artifacts,
      graphSelector,
      interaction,
      overlaySelector,
      panPixels,
      referenceImage,
      resolvedGraphSelector,
      rootSelector,
      timestamp: new Date().toISOString(),
      thresholds: {
        minCoverage,
        minHueBuckets,
        minOccupiedCells,
        minReferenceScore,
        strictReference: weakReferenceStatus === "fail",
        strictTexture: weakTextureStatus === "fail",
      },
      url,
      viewport,
    },
    summary,
  };
  await mkdir(resultsDir, { recursive: true });
  const reportPath = join(resultsDir, "ui-evaluator-latest.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2));

  console.table(checks);
  console.log(
    `UI graph evaluator: pass=${summary.pass} warn=${summary.warn} fail=${summary.fail}`,
  );
  console.log(`Report written to ${reportPath}`);

  if (gate && summary.fail > 0) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
