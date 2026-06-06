import { describe, expect, it } from "vitest";
import {
  ATLAS_LOD_CONFIG,
  getLodForZoom,
  shouldFetchPoints,
} from "@/lib/atlas/lod";

describe("atlas LOD selection", () => {
  it("uses density, clusters, then points at configured zoom bands", () => {
    expect(getLodForZoom(ATLAS_LOD_CONFIG.densityMaxZoom - 0.01).layer).toBe(
      "density",
    );
    expect(getLodForZoom(ATLAS_LOD_CONFIG.densityMaxZoom).layer).toBe(
      "clusters",
    );
    expect(getLodForZoom(ATLAS_LOD_CONFIG.pointsMinZoom).layer).toBe(
      "points",
    );
  });

  it("blocks raw point fetches below high zoom", () => {
    expect(shouldFetchPoints(2.9)).toBe(false);
    expect(shouldFetchPoints(6)).toBe(false);
    expect(shouldFetchPoints(6.01)).toBe(true);
  });
});
