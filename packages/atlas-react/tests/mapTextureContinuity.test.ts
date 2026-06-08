import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MONOREPO_ROOT = join(PACKAGE_ROOT, "../..");

describe("atlas map texture continuity", () => {
  it("keeps a retained density context available after the viewport switches LOD", () => {
    const viewer = readFileSync(
      join(MONOREPO_ROOT, "apps/semantic-atlas/components/atlas/AtlasViewer.tsx"),
      "utf8",
    );

    expect(viewer).toContain("densityContextTiles");
    expect(viewer).toContain("canvasDensityTiles");
    expect(viewer).toContain("setDensityContextTiles(densityTiles)");
  });

  it("renders point-context stipple over cluster and point LOD without React point nodes", () => {
    const canvas = readFileSync(
      join(PACKAGE_ROOT, "src/components/atlas/AtlasCanvas.tsx"),
      "utf8",
    );

    expect(canvas).toContain("buildPointContextStipple");
    expect(canvas).toContain("atlasTextureColor");
    expect(canvas).toContain("drawTextureDot");
    expect(canvas).toContain("const maxCount = 216000");
    expect(canvas).toContain("const ambientReserve = Math.min");
    expect(canvas).toContain("Math.max(14000, Math.round(samples.length * 110))");
    expect(canvas).toContain("const interstitialReserve = Math.min");
    expect(canvas).toContain("Math.max(36000, Math.round(samples.length * 220))");
    expect(canvas).toContain("const ambientCount = Math.min(maxCount - points.length, ambientReserve)");
    expect(canvas).toContain("density-interstitial-stipple");
    expect(canvas).toContain("density-interstitial-${index}");
    expect(canvas).toContain("group.samples.length * 56");
    expect(canvas).toContain("sample.weight * 36");
    expect(canvas).toContain("data-atlas-point-context-count");
    expect(canvas).toContain('data-testid="atlas-overlay"');
    expect(canvas).toMatch(/isClusterLod\s*\?\s*52000\s*:\s*90000/);
    expect(canvas).not.toMatch(/renderedPoints\.map/);
  });
});
