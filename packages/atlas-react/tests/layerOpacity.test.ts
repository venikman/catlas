import { describe, expect, it } from "vitest";
import { getAtlasLayerOpacities } from "@/lib/atlas/layerOpacity";

describe("atlas layer opacity model", () => {
  it("keeps low zoom focused on semantic tissue and region labels", () => {
    const opacity = getAtlasLayerOpacities(1.8);

    expect(opacity.density).toBeGreaterThan(0.95);
    expect(opacity.regionLabels).toBeGreaterThan(0.95);
    expect(opacity.points).toBe(0);
    expect(opacity.pointLabels).toBe(0);
  });

  it("keeps branches subtle during neighborhood zoom without exposing points early", () => {
    const opacity = getAtlasLayerOpacities(4.6);

    expect(opacity.clusters).toBeGreaterThan(0.9);
    expect(opacity.density).toBeGreaterThan(0.25);
    expect(opacity.regionLabels).toBeGreaterThan(0.35);
    expect(opacity.branches).toBeGreaterThan(0);
    expect(opacity.branches).toBeLessThan(0.35);
    expect(opacity.points).toBe(0);
  });

  it("fades to high-zoom points after retiring branches", () => {
    const opacity = getAtlasLayerOpacities(7.2);

    expect(opacity.points).toBeGreaterThan(0.95);
    expect(opacity.pointLabels).toBeGreaterThan(0.95);
    expect(opacity.density).toBeGreaterThan(0.28);
    expect(opacity.regionLabels).toBeGreaterThan(0.25);
    expect(opacity.clusters).toBeGreaterThan(0.08);
    expect(opacity.clusters).toBeLessThan(0.16);
    expect(opacity.branches).toBeLessThan(0.05);
  });
});
