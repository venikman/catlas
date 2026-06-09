import { describe, expect, it } from "vitest";
import { summarize } from "../src/reporters/summary";
import type { CheckResult, ValidatorResult } from "../src/types";

function vr(results: CheckResult[]): ValidatorResult {
  return { validator: "test", results };
}

describe("summarize", () => {
  it("counts checks by status", () => {
    const summary = summarize([
      vr([
        { id: "a", category: "x", label: "A", status: "pass", severity: "error", detail: "" },
        { id: "b", category: "x", label: "B", status: "warn", severity: "warn", detail: "" },
        { id: "c", category: "x", label: "C", status: "skip", severity: "warn", detail: "" },
        { id: "d", category: "x", label: "D", status: "fail", severity: "warn", detail: "" },
      ]),
    ]);

    expect(summary).toMatchObject({ pass: 1, warn: 1, skip: 1, fail: 1 });
  });

  it("counts only load-bearing failures as gate failures", () => {
    const summary = summarize([
      vr([
        { id: "soft", category: "x", label: "soft", status: "fail", severity: "warn", detail: "" },
        { id: "hard", category: "x", label: "hard", status: "fail", severity: "error", detail: "" },
      ]),
    ]);

    expect(summary.fail).toBe(2);
    expect(summary.gateFailures).toBe(1);
  });
});
