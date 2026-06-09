import { describe, expect, it } from "vitest";
import {
  parseAtlasBboxParams,
  parseAtlasSearchParams,
} from "@/lib/atlas/validation";

describe("atlas request validation", () => {
  it("accepts valid bounded bbox params", () => {
    const result = parseAtlasBboxParams(
      new URLSearchParams({
        view: "research-domains",
        zoom: "4.2",
        minX: "-1.5",
        maxX: "1.5",
        minY: "-2",
        maxY: "2",
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.bbox.width).toBe(3);
      expect(result.value.limit).toBeLessThanOrEqual(5000);
    }
  });

  it("rejects inverted or unbounded bbox params", () => {
    const inverted = parseAtlasBboxParams(
      new URLSearchParams({
        view: "research-domains",
        zoom: "4",
        minX: "3",
        maxX: "1",
        minY: "-2",
        maxY: "2",
      }),
    );
    const huge = parseAtlasBboxParams(
      new URLSearchParams({
        view: "research-domains",
        zoom: "4",
        minX: "-1000",
        maxX: "1000",
        minY: "-1000",
        maxY: "1000",
      }),
    );

    expect(inverted.ok).toBe(false);
    expect(huge.ok).toBe(false);
  });

  it("rejects excessive high-zoom point bboxes", () => {
    const result = parseAtlasBboxParams(
      new URLSearchParams({
        view: "research-domains",
        zoom: "7.2",
        minX: "-10",
        maxX: "10",
        minY: "-1",
        maxY: "1",
      }),
    );

    expect(result.ok).toBe(false);
  });

  it("keeps search lightweight and trims query text", () => {
    const result = parseAtlasSearchParams(
      new URLSearchParams({
        view: "research-domains",
        q: "  graph neural networks  ",
        limit: "80",
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.q).toBe("graph neural networks");
      expect(result.value.limit).toBe(20);
    }
  });

  it("rejects search queries below the configured minimum length", () => {
    const tooShort = parseAtlasSearchParams(
      new URLSearchParams({ view: "research-domains", q: "x" }),
    );
    expect(tooShort.ok).toBe(false);
    if (!tooShort.ok) {
      expect(tooShort.status).toBe(400);
    }

    const longEnough = parseAtlasSearchParams(
      new URLSearchParams({ view: "research-domains", q: "ml" }),
    );
    expect(longEnough.ok).toBe(true);
  });
});
