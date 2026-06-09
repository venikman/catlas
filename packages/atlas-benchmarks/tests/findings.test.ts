import { describe, expect, it } from "vitest";
import {
  createReportFindings,
  isSotaMiss,
} from "../src/reporters/findings";
import type { CheckResult, ValidatorResult } from "../src/types";

function result(overrides: Partial<CheckResult> & Pick<CheckResult, "id" | "status">): CheckResult {
  return {
    category: "test",
    detail: `detail for ${overrides.id}`,
    label: `label for ${overrides.id}`,
    severity: "error",
    ...overrides,
  };
}

function validators(results: CheckResult[]): ValidatorResult[] {
  return [{ results, validator: "test" }];
}

describe("createReportFindings", () => {
  it("buckets hard failures, warnings, skips, and sota misses", () => {
    const findings = createReportFindings(
      validators([
        result({ id: "hard-fail", severity: "error", status: "fail" }),
        result({ id: "advisory-fail", severity: "warn", status: "fail" }),
        result({ id: "plain-warn", severity: "warn", status: "warn" }),
        result({ id: "a-skip", severity: "warn", status: "skip" }),
        result({
          comparison: "lte",
          id: "sota-miss",
          measured: 900,
          sotaBudget: 500,
          status: "pass",
        }),
        result({ id: "clean-pass", status: "pass" }),
      ]),
    );

    expect(findings.hardFailures.map((finding) => finding.id)).toEqual([
      "hard-fail",
    ]);
    expect(findings.warnings.map((finding) => finding.id).sort()).toEqual([
      "advisory-fail",
      "plain-warn",
    ]);
    expect(findings.skipped.map((finding) => finding.id)).toEqual(["a-skip"]);
    expect(findings.sotaMisses.map((finding) => finding.id)).toEqual([
      "sota-miss",
    ]);
  });

  it("carries teach fields into findings", () => {
    const findings = createReportFindings(
      validators([
        result({
          docRef: "docs/adoption/benchmark-interpretation.md#hard-fail",
          fix: "Do the fix.",
          id: "hard-fail",
          rationale: "It matters because reasons.",
          severity: "error",
          status: "fail",
        }),
      ]),
    );

    const finding = findings.hardFailures[0];
    expect(finding.rationale).toBe("It matters because reasons.");
    expect(finding.fix).toBe("Do the fix.");
    expect(finding.docRef).toBe(
      "docs/adoption/benchmark-interpretation.md#hard-fail",
    );
  });
});

describe("isSotaMiss", () => {
  it("flags lte checks measured above the sota budget", () => {
    expect(
      isSotaMiss(
        result({
          comparison: "lte",
          id: "lte-miss",
          measured: 900,
          sotaBudget: 500,
          status: "pass",
        }),
      ),
    ).toBe(true);
    expect(
      isSotaMiss(
        result({
          comparison: "lte",
          id: "lte-ok",
          measured: 400,
          sotaBudget: 500,
          status: "pass",
        }),
      ),
    ).toBe(false);
  });

  it("flags gte checks measured below the sota budget", () => {
    expect(
      isSotaMiss(
        result({
          comparison: "gte",
          id: "gte-miss",
          measured: 40,
          sotaBudget: 60,
          status: "pass",
        }),
      ),
    ).toBe(true);
    expect(
      isSotaMiss(
        result({
          comparison: "gte",
          id: "gte-ok",
          measured: 80,
          sotaBudget: 60,
          status: "pass",
        }),
      ),
    ).toBe(false);
  });

  it("is false when measurement or sota budget is missing", () => {
    expect(isSotaMiss(result({ id: "no-measure", status: "pass" }))).toBe(false);
    expect(
      isSotaMiss(result({ id: "no-sota", measured: 10, status: "pass" })),
    ).toBe(false);
  });
});
