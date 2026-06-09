import { describe, expect, it } from "vitest";
import { percentiles, round } from "../src/types";

describe("percentiles", () => {
  it("returns all zeros for an empty sample", () => {
    expect(percentiles([])).toEqual({
      count: 0,
      max: 0,
      min: 0,
      p50: 0,
      p95: 0,
      p99: 0,
    });
  });

  it("computes p50/p95/p99/min/max for a known distribution", () => {
    const values = Array.from({ length: 100 }, (_, index) => index + 1);

    expect(percentiles(values)).toEqual({
      count: 100,
      max: 100,
      min: 1,
      p50: 51,
      p95: 96,
      p99: 100,
    });
  });

  it("is order-independent", () => {
    const ascending = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = [7, 2, 10, 5, 1, 9, 3, 8, 6, 4];

    expect(percentiles(shuffled)).toEqual(percentiles(ascending));
  });

  it("collapses to the single value for a one-element sample", () => {
    expect(percentiles([42])).toEqual({
      count: 1,
      max: 42,
      min: 42,
      p50: 42,
      p95: 42,
      p99: 42,
    });
  });
});

describe("round", () => {
  it("rounds to two decimal places", () => {
    expect(round(1.234)).toBe(1.23);
    expect(round(1.235)).toBe(1.24);
    expect(round(10)).toBe(10);
  });
});
