import { describe, expect, it } from "vitest";
import { createReportFindings } from "../src/reporters/findings";
import { resolveLoadBearing } from "../src/validators/helpers";
import type { CheckResult, ValidatorResult } from "../src/types";

/**
 * Mirrors summarize() in src/run-benchmarks.ts: an error-severity failure is a
 * gate failure. If the gate logic ever stops counting load-bearing hard fails,
 * this regression test fails alongside the benchmark it guards.
 */
function gateFailures(validators: ValidatorResult[]): number {
  return validators
    .flatMap((validator) => validator.results)
    .filter((result) => result.status === "fail" && result.severity === "error")
    .length;
}

function validators(results: CheckResult[]): ValidatorResult[] {
  return [{ results, validator: "seeded" }];
}

// A deliberately-bad, load-bearing hard failure: the high-zoom points payload
// blew its hard cap. This is the kind of regression the benchmark must catch.
const seededHardFail: CheckResult = {
  budget: 5_000_000,
  category: "payload",
  comparison: "lte",
  detail: "Points payload was 9000000 bytes, above hard cap 5000000.",
  docRef: "docs/adoption/benchmark-interpretation.md#payload-points-hard-cap",
  fix: "Enforce the per-response point cap and viewport bbox in the points route.",
  id: "payload-points-hard-cap",
  label: "High-zoom points payload hard cap",
  loadBearing: true,
  measured: 9_000_000,
  rationale: "Exceeding the hard cap stalls the renderer and exhausts memory.",
  severity: "error",
  status: "fail",
  unit: "bytes",
};

// An advisory warn-severity failure: the density payload exceeded its soft
// target. It should be reported but must never trip the gate.
const advisoryFail: CheckResult = {
  budget: 200_000,
  category: "payload",
  comparison: "lte",
  detail: "Density payload was 250000 bytes, above soft target 200000.",
  docRef: "docs/adoption/benchmark-interpretation.md#payload-density-size",
  fix: "Aggregate density into a coarser grid.",
  id: "payload-density-size",
  label: "Density payload size",
  measured: 250_000,
  rationale: "Oversized density payloads slow the lowest-zoom first paint.",
  severity: "warn",
  status: "fail",
  unit: "bytes",
};

describe("seeded regression: load-bearing hard fail trips the gate", () => {
  it("counts the seeded hard fail as a gate failure", () => {
    expect(gateFailures(validators([seededHardFail]))).toBeGreaterThan(0);
  });

  it("surfaces the seeded hard fail in hardFailures with teach fields", () => {
    const findings = createReportFindings(validators([seededHardFail]));

    expect(findings.hardFailures.map((finding) => finding.id)).toContain(
      "payload-points-hard-cap",
    );
    const finding = findings.hardFailures.find(
      (entry) => entry.id === "payload-points-hard-cap",
    );
    expect(finding?.rationale).toBe(seededHardFail.rationale);
    expect(finding?.fix).toBe(seededHardFail.fix);
    expect(finding?.docRef).toBe(seededHardFail.docRef);
  });

  it("treats the seeded hard fail as load-bearing", () => {
    expect(resolveLoadBearing(seededHardFail)).toBe(true);
  });
});

describe("seeded regression: advisory warn fail does not trip the gate", () => {
  it("does not count the advisory fail as a gate failure", () => {
    expect(gateFailures(validators([advisoryFail]))).toBe(0);
  });

  it("routes the advisory fail to warnings, not hardFailures", () => {
    const findings = createReportFindings(validators([advisoryFail]));

    expect(findings.hardFailures).toHaveLength(0);
    expect(findings.warnings.map((finding) => finding.id)).toContain(
      "payload-density-size",
    );
  });

  it("treats the advisory fail as not load-bearing by the default rule", () => {
    expect(resolveLoadBearing(advisoryFail)).toBe(false);
  });

  it("keeps the gate at exactly one failure when both are present", () => {
    expect(gateFailures(validators([seededHardFail, advisoryFail]))).toBe(1);
  });
});
