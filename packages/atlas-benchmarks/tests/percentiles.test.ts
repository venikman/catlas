import { describe, expect, it } from "vitest";
import { percentiles, round } from "../src/types";

describe("percentiles", () => {
  it("returns a zeroed sample for empty input", () => {
    expect(percentiles([])).toEqual({
      count: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      min: 0,
      max: 0,
    });
  });

  it("computes count, min, max, and monotonic percentiles regardless of input order", () => {
    const sample = percentiles([10, 1, 5, 3, 2, 9, 7, 4, 6, 8]);
    expect(sample.count).toBe(10);
    expect(sample.min).toBe(1);
    expect(sample.max).toBe(10);
    expect(sample.p50).toBeLessThanOrEqual(sample.p95);
    expect(sample.p95).toBeLessThanOrEqual(sample.p99);
  });

  it("rounds to two decimal places", () => {
    expect(round(1.23456)).toBe(1.23);
  });
});
