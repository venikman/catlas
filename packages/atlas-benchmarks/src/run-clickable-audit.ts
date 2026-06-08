#!/usr/bin/env node

import { access, mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

type AuditStatus = "pass" | "warn" | "fail";

type AuditCheck = {
  check: string;
  detail: string;
  status: AuditStatus;
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

function check(status: AuditStatus, checkName: string, detail: string): AuditCheck {
  return { check: checkName, detail, status };
}

function printHelp() {
  console.log(`Atlas clickable audit

Usage:
  run-clickable-audit --url=http://localhost:3002 [options]

Options:
  --url URL                         Atlas app URL. Defaults to ATLAS_BASE_URL then http://localhost:3002.
  --viewport WIDTHxHEIGHT           Browser viewport. Defaults to 1440x900.
  --wait MS                         Wait after interactions. Defaults to 750.
  --gate                            Exit non-zero when fail-level checks are present.
  --record-video, --video           Write interaction.webm.
  --artifacts-dir DIR               Artifact directory. Defaults to outputs/atlas-benchmarks/clickable-audit-artifacts.
  --results-dir DIR                 JSON report directory. Defaults to outputs/atlas-benchmarks.
  --browser-executable PATH         Browser binary. Defaults to UI_EVAL_BROWSER_EXECUTABLE or common macOS Chrome/Chromium paths.
`);
}

function parseViewport(raw: string): { width: number; height: number } {
  const [width, height] = raw.split("x").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`Invalid viewport "${raw}". Use WIDTHxHEIGHT, for example 1440x900.`);
  }
  return { width, height };
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

async function activeLod(page: Page): Promise<string | null> {
  return page
    .locator('[data-atlas-kind="lod-button"][aria-pressed="true"]')
    .getAttribute("data-atlas-lod");
}

async function zoomValue(page: Page): Promise<number> {
  const slider = page.locator('input[aria-label="Zoom"]');
  if ((await slider.count()) === 1) {
    return Number.parseFloat(await slider.inputValue());
  }

  const raw = await page.locator('output[aria-label="Zoom level"]').innerText();
  return Number.parseFloat(raw.replace(/x$/i, ""));
}

async function openViewSettingsTab(page: Page) {
  const viewTab = page.locator(".sidecar-tabs button", { hasText: "View" });
  if ((await viewTab.count()) === 1) {
    await viewTab.click({ force: true });
  }
}

async function waitForAtlasIdle(page: Page, waitMs: number) {
  await page.waitForTimeout(waitMs);
  await page.locator('[data-testid="atlas-map-canvas"]').waitFor({
    state: "attached",
    timeout: 5000,
  });
}

async function canvasCounts(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="atlas-map-canvas"]');
    return {
      densityStippleCount: Number(canvas?.getAttribute("data-atlas-density-stipple-count") ?? 0),
      pointContextCount: Number(canvas?.getAttribute("data-atlas-point-context-count") ?? 0),
      pointCount: Number(canvas?.getAttribute("data-atlas-point-count") ?? 0),
    };
  });
}

async function assertNonblankCanvas(page: Page, checks: AuditCheck[], label: string) {
  const counts = await canvasCounts(page);
  const total =
    counts.densityStippleCount + counts.pointContextCount + counts.pointCount;
  checks.push(
    total > 0
      ? check(
          "pass",
          `${label} keeps map nonblank`,
          `density=${counts.densityStippleCount}, pointContext=${counts.pointContextCount}, points=${counts.pointCount}.`,
        )
      : check("fail", `${label} keeps map nonblank`, "Canvas exposed no rendered map counts."),
  );
}

async function clickLod(page: Page, checks: AuditCheck[], lod: string, waitMs: number) {
  const button = page.locator(`[data-atlas-kind="lod-button"][data-atlas-lod="${lod}"]`);
  const count = await button.count();
  checks.push(
    count === 1
      ? check("pass", `${lod} LOD button exists`, "Found exactly one button.")
      : check("fail", `${lod} LOD button exists`, `Found ${count} buttons.`),
  );
  if (count !== 1) return;

  await button.click({ force: true });
  await waitForAtlasIdle(page, waitMs);
  const current = await activeLod(page);
  checks.push(
    current === lod
      ? check("pass", `${lod} LOD button changes active state`, `Active LOD is ${current}.`)
      : check("fail", `${lod} LOD button changes active state`, `Active LOD is ${current}.`),
  );
  await assertNonblankCanvas(page, checks, `${lod} LOD`);
}

async function auditLayerToggles(page: Page, checks: AuditCheck[], waitMs: number) {
  await openViewSettingsTab(page);
  const layers = await page
    .locator('[data-atlas-kind="layer-toggle"]')
    .evaluateAll((buttons) =>
      buttons.map((button) => ({
        layer: button.getAttribute("data-atlas-layer") ?? "",
        pressed: button.getAttribute("aria-pressed") === "true",
      })),
    );

  checks.push(
    layers.length >= 6
      ? check("pass", "Layer toggles exist", `Found ${layers.length} layer toggles.`)
      : check("fail", "Layer toggles exist", `Found ${layers.length} layer toggles.`),
  );

  for (const layer of layers) {
    if (!layer.layer) continue;
    const toggle = page.locator(`[data-atlas-kind="layer-toggle"][data-atlas-layer="${layer.layer}"]`);
    await toggle.click({ force: true });
    await page.waitForTimeout(Math.min(waitMs, 350));
    const next = (await toggle.getAttribute("aria-pressed")) === "true";
    checks.push(
      next !== layer.pressed
        ? check("pass", `Layer ${layer.layer} toggles`, `${layer.pressed} -> ${next}.`)
        : check("fail", `Layer ${layer.layer} toggles`, `State remained ${next}.`),
    );
    await toggle.click({ force: true });
    await page.waitForTimeout(Math.min(waitMs, 350));
    const restored = (await toggle.getAttribute("aria-pressed")) === "true";
    checks.push(
      restored === layer.pressed
        ? check("pass", `Layer ${layer.layer} restores`, `${next} -> ${restored}.`)
        : check("fail", `Layer ${layer.layer} restores`, `Expected ${layer.pressed}, got ${restored}.`),
    );
  }
}

async function auditViewButtons(page: Page, checks: AuditCheck[], waitMs: number) {
  await openViewSettingsTab(page);
  const views = await page
    .locator('[data-atlas-kind="view-button"]')
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("data-atlas-view") ?? "").filter(Boolean),
    );
  checks.push(
    views.length >= 4
      ? check("pass", "Top view buttons exist", `Found ${views.length} view buttons.`)
      : check("fail", "Top view buttons exist", `Found ${views.length} view buttons.`),
  );

  for (const view of views) {
    const button = page.locator(`[data-atlas-kind="view-button"][data-atlas-view="${view}"]`);
    await button.click({ force: true });
    await waitForAtlasIdle(page, waitMs);
    const pressed = (await button.getAttribute("aria-pressed")) === "true";
    checks.push(
      pressed
        ? check("pass", `View ${view} activates`, "aria-pressed=true.")
        : check("fail", `View ${view} activates`, "aria-pressed was not true."),
    );
    await assertNonblankCanvas(page, checks, `View ${view}`);
  }
}

async function auditSearchAndInspector(page: Page, checks: AuditCheck[], waitMs: number) {
  await openViewSettingsTab(page);
  const allView = page.locator('[data-atlas-kind="view-button"][data-atlas-view="research-domains"]');
  if ((await allView.count()) === 1) {
    await allView.click({ force: true });
    await waitForAtlasIdle(page, waitMs);
  }

  const search = page.locator('[data-testid="atlas-search-input"]');
  await search.fill("graph");
  await page.waitForSelector('[data-atlas-kind="search-result"]', {
    state: "visible",
    timeout: 8000,
  }).catch(() => undefined);
  const resultCount = await page.locator('[data-atlas-kind="search-result"]').count();
  checks.push(
    resultCount > 0
      ? check("pass", "Search returns clickable results", `Found ${resultCount} results.`)
      : check("fail", "Search returns clickable results", "Found no results."),
  );

  if (resultCount > 0) {
    await page.locator('[data-atlas-kind="search-result"]').first().click({ force: true });
    await page.locator('[data-testid="atlas-side-panel"]').waitFor({
      state: "visible",
      timeout: 8000,
    });
    checks.push(check("pass", "Search result opens inspector", "Side panel became visible."));
    await assertNonblankCanvas(page, checks, "Search result selection");
    const close =
      (await page.locator('button[aria-label="Close inspector"]').count()) === 1
        ? page.locator('button[aria-label="Close inspector"]')
        : page.locator('button[aria-label="Collapse rail"]');
    await close.click({ force: true });
    await page.waitForTimeout(waitMs);
    const panelVisible = await page.locator('[data-testid="atlas-side-panel"]').isVisible();
    checks.push(
      !panelVisible
        ? check("pass", "Inspector close works after search selection", "Side panel hidden.")
        : check("fail", "Inspector close works after search selection", "Side panel remained visible."),
    );
  }

  const clear = page.locator('button[aria-label="Clear search"]');
  if ((await clear.count()) === 1) {
    await clear.click({ force: true });
    const value = await search.inputValue();
    checks.push(
      value === ""
        ? check("pass", "Clear search works", "Search input is empty.")
        : check("fail", "Clear search works", `Search input value is "${value}".`),
    );
  } else {
    checks.push(check("warn", "Clear search works", "Clear button was not present."));
  }
}

async function auditClusterClick(page: Page, checks: AuditCheck[], waitMs: number) {
  await clickLod(page, checks, "clusters", waitMs);
  const clusters = page.locator('svg [data-atlas-kind="cluster"]');
  const count = await clusters.count();
  checks.push(
    count > 0
      ? check("pass", "Cluster click target exists", `Found ${count} cluster nodes.`)
      : check("fail", "Cluster click target exists", "No cluster nodes found."),
  );
  if (count === 0) return;

  const visibleClusterIndex = await clusters.evaluateAll((nodes) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    return nodes.findIndex((node) => {
      const rect = node.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.left >= 0 &&
        rect.top >= 0 &&
        rect.right <= viewportWidth &&
        rect.bottom <= viewportHeight
      );
    });
  });
  checks.push(
    visibleClusterIndex >= 0
      ? check("pass", "Visible cluster click target exists", `Using cluster index ${visibleClusterIndex}.`)
      : check("fail", "Visible cluster click target exists", "No visible cluster node found."),
  );
  if (visibleClusterIndex < 0) return;

  await clusters.nth(visibleClusterIndex).click({ force: true });
  await page.locator('[data-testid="atlas-side-panel"]').waitFor({
    state: "visible",
    timeout: 8000,
  });
  checks.push(check("pass", "Cluster click opens inspector", "Side panel became visible."));
  const close =
    (await page.locator('button[aria-label="Close inspector"]').count()) === 1
      ? page.locator('button[aria-label="Close inspector"]')
      : page.locator('button[aria-label="Collapse rail"]');
  await close.click({ force: true });
  await page.waitForTimeout(waitMs);
}

async function auditViewportInteraction(page: Page, checks: AuditCheck[], waitMs: number) {
  const overlay = page.locator('[data-testid="atlas-overlay"]');
  const beforeViewBox = await overlay.getAttribute("viewBox");
  const box = await page.locator('[data-testid="atlas-canvas"]').boundingBox();
  if (!box) {
    checks.push(check("fail", "Map interaction target exists", "Atlas canvas has no bounds."));
    return;
  }

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  await page.mouse.move(centerX, centerY);
  await page.mouse.wheel(0, -700);
  await page.mouse.down();
  await page.mouse.move(centerX + 160, centerY + 55, { steps: 8 });
  await page.mouse.up();
  await waitForAtlasIdle(page, waitMs);
  const afterViewBox = await overlay.getAttribute("viewBox");
  checks.push(
    beforeViewBox !== afterViewBox
      ? check(
          "pass",
          "Map wheel and pan update viewport",
          `viewBox changed from "${beforeViewBox}" to "${afterViewBox}".`,
        )
      : check("fail", "Map wheel and pan update viewport", `viewBox remained "${afterViewBox}".`),
  );
}

async function auditZoomAndHome(page: Page, checks: AuditCheck[], waitMs: number) {
  const before = await zoomValue(page);
  await page
    .locator('[data-atlas-kind="map-control"][data-atlas-action="zoom-in"]')
    .click({ force: true });
  await waitForAtlasIdle(page, waitMs);
  const zoomedIn = await zoomValue(page);
  checks.push(
    zoomedIn > before
      ? check("pass", "Zoom in changes zoom", `${before} -> ${zoomedIn}.`)
      : check("fail", "Zoom in changes zoom", `${before} -> ${zoomedIn}.`),
  );

  await page
    .locator('[data-atlas-kind="map-control"][data-atlas-action="zoom-out"]')
    .click({ force: true });
  await waitForAtlasIdle(page, waitMs);
  const zoomedOut = await zoomValue(page);
  checks.push(
    zoomedOut < zoomedIn
      ? check("pass", "Zoom out changes zoom", `${zoomedIn} -> ${zoomedOut}.`)
      : check("fail", "Zoom out changes zoom", `${zoomedIn} -> ${zoomedOut}.`),
  );

  await clickLod(page, checks, "points", waitMs);
  const beforeHome = await zoomValue(page);
  await page.evaluate(() => {
    document
      .querySelector<HTMLButtonElement>(
        '[data-atlas-kind="map-control"][data-atlas-action="home"]',
      )
      ?.click();
  });
  await page
    .waitForFunction(
      (previous) => {
        const raw =
          document.querySelector('output[aria-label="Zoom level"]')?.textContent ?? "";
        const next = Number.parseFloat(raw.replace(/x$/i, ""));
        return Number.isFinite(next) && next < previous;
      },
      beforeHome,
      { timeout: 5000 },
    )
    .catch(() => undefined);
  await waitForAtlasIdle(page, waitMs);
  const afterHome = await zoomValue(page);
  checks.push(
    afterHome < beforeHome
      ? check("pass", "Home resets zoom", `${beforeHome} -> ${afterHome}.`)
      : check("fail", "Home resets zoom", `${beforeHome} -> ${afterHome}.`),
  );
}

async function auditDisabledPlaceholders(page: Page, checks: AuditCheck[]) {
  const functionalControls = await page.evaluate(() => {
    const selectors = [
      'button[aria-label="Zoom in"]',
      'button[aria-label="Zoom out"]',
      'button[aria-label="Fit map"]',
      '[data-testid="atlas-search-input"]',
    ];
    return selectors.map((selector) => {
      const element = document.querySelector<HTMLElement>(selector);
      const disabled =
        element instanceof HTMLButtonElement ||
        element instanceof HTMLInputElement
          ? Boolean(element.disabled)
          : false;
      return { disabled, present: Boolean(element), selector };
    });
  });

  for (const item of functionalControls) {
    checks.push(
      item.present && !item.disabled
        ? check("pass", `Control ${item.selector} is interactive`, "Enabled and present.")
        : check(
            "fail",
            `Control ${item.selector} is interactive`,
            `present=${item.present}, disabled=${item.disabled}.`,
          ),
    );
  }
}

async function run() {
  if (flag("help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }

  const url =
    arg("url", process.env.ATLAS_BASE_URL ?? process.env.UI_EVAL_URL) ??
    "http://localhost:3002";
  const viewport = parseViewport(arg("viewport", "1440x900")!);
  const waitMs = Number.parseInt(arg("wait", "750")!, 10);
  const gate = flag("gate");
  const resultsDir = arg("results-dir", "outputs/atlas-benchmarks")!;
  const artifactsDir = arg("artifacts-dir", join(resultsDir, "clickable-audit-artifacts"))!;
  const recordVideo = flag("record-video") || flag("video");

  await mkdir(resultsDir, { recursive: true });
  if (recordVideo) await mkdir(artifactsDir, { recursive: true });

  const executablePath = await existingBrowserExecutable();
  const browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    recordVideo: recordVideo ? { dir: artifactsDir, size: viewport } : undefined,
  });
  const page = await context.newPage();
  const checks: AuditCheck[] = [];
  const messages: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      messages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => messages.push(`pageerror: ${error.message}`));

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await waitForAtlasIdle(page, waitMs);
  checks.push(check("pass", "Atlas page loads", `Loaded "${await page.title()}" at ${page.url()}.`));
  checks.push(
    (await page.locator('[data-testid="atlas-root"]').count()) === 1
      ? check("pass", "Atlas root exists", "Found one atlas root.")
      : check("fail", "Atlas root exists", "Atlas root count was not one."),
  );

  await auditDisabledPlaceholders(page, checks);
  await clickLod(page, checks, "density", waitMs);
  await clickLod(page, checks, "clusters", waitMs);
  await clickLod(page, checks, "points", waitMs);
  await auditZoomAndHome(page, checks, waitMs);
  await auditLayerToggles(page, checks, waitMs);
  await auditViewButtons(page, checks, waitMs);
  await auditSearchAndInspector(page, checks, waitMs);
  await auditClusterClick(page, checks, waitMs);
  await auditViewportInteraction(page, checks, waitMs);

  checks.push(
    messages.length === 0
      ? check("pass", "Console health", "No console warnings/errors or page errors.")
      : check("fail", "Console health", messages.slice(0, 8).join("; ")),
  );

  const video = page.video();
  await context.close();
  await browser.close();
  const artifacts: { video?: string } = {};
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
    artifacts,
    checks,
    meta: {
      timestamp: new Date().toISOString(),
      url,
      viewport,
    },
    summary,
  };
  const reportPath = join(resultsDir, "clickable-audit-latest.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2));

  console.table(checks);
  console.log(
    `Atlas clickable audit: pass=${summary.pass} warn=${summary.warn} fail=${summary.fail}`,
  );
  console.log(`Report written to ${reportPath}`);
  if (artifacts.video) console.log(`Video written to ${artifacts.video}`);

  if (gate && summary.fail > 0) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
