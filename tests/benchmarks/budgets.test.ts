import { describe, expect, it } from "vitest";
import { ATLAS_BUDGETS, BUDGETS } from "../../benchmarks/budgets";

describe("benchmark budgets", () => {
  it("encodes the Semantic Atlas SOTA scorecard tiers", () => {
    expect(ATLAS_BUDGETS.webVitals.lcpMs).toEqual({ good: 2500, sota: 1500 });
    expect(ATLAS_BUDGETS.webVitals.inpMs).toEqual({ good: 200, sota: 100 });
    expect(ATLAS_BUDGETS.webVitals.cls).toEqual({ good: 0.1, sota: 0.03 });

    expect(ATLAS_BUDGETS.apiP95Ms.views).toEqual({ good: 100, sota: 50 });
    expect(ATLAS_BUDGETS.apiP95Ms.points).toEqual({ good: 300, sota: 150 });
    expect(ATLAS_BUDGETS.payloadBytes.points).toEqual({
      good: 2_000_000,
      sota: 750_000,
    });
    expect(ATLAS_BUDGETS.responseLimits.maxSearchResults).toBe(20);
    expect(ATLAS_BUDGETS.rendering.maxReactPointComponents).toBe(0);
  });

  it("keeps validator compatibility budgets derived from ATLAS_BUDGETS", () => {
    expect(BUDGETS.apiLatencyMsP95.views).toBe(
      ATLAS_BUDGETS.apiP95Ms.views.good,
    );
    expect(BUDGETS.apiLatencyMsP95.search).toBe(
      ATLAS_BUDGETS.apiP95Ms.search.good,
    );
    expect(BUDGETS.payloadBytes.initialSoftTarget).toBe(
      ATLAS_BUDGETS.payloadBytes.initialAtlas.good,
    );
    expect(BUDGETS.payloadBytes.pointsHardCap).toBe(
      ATLAS_BUDGETS.payloadBytes.points.good,
    );
    expect(BUDGETS.hardCaps.initialAtlasPayloadBytes).toBe(2_000_000);
    expect(BUDGETS.hardCaps.highZoomPointPayloadBytes).toBe(5_000_000);
    expect(BUDGETS.bounds.maxSearchResults).toBe(
      ATLAS_BUDGETS.responseLimits.maxSearchResults,
    );
  });
});
