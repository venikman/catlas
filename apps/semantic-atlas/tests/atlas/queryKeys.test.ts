import { describe, expect, it } from "vitest";
import { atlasQueryKeys, bboxKey } from "@/lib/atlas/queryKeys";

describe("atlas query keys", () => {
  it("rounds bboxes to stable tile-like keys", () => {
    expect(
      bboxKey({ minX: -1.2344, maxX: 1.2344, minY: -9.8765, maxY: 9.8765 }),
    ).toBe("-1.23:1.23:-9.88:9.88");
  });

  it("includes view, lod, zoom band, and bbox in viewport keys", () => {
    expect(
      atlasQueryKeys.viewport({
        view: "topics",
        lod: "clusters",
        zoomBand: "3-6",
        bbox: { minX: -1, maxX: 1, minY: -2, maxY: 2 },
      }),
    ).toEqual(["atlas", "viewport", "topics", "clusters", "3-6", "-1:1:-2:2"]);
  });
});
