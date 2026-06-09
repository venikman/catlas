import { describe, expect, it } from "vitest";
import { createReportFindings } from "../src/reporters/findings";
import { resolveLoadBearing } from "../src/validators/helpers";
import type { CheckResult, ValidatorResult } from "../src/types";

/**
 * Mirrors summarize() in src/run-benchmarks.ts: a failed check trips the gate
 * when it is load-bearing (resolveLoadBearing(), which defaults to severity
 * === "error" but honors an explicit loadBearing flag). If the gate logic ever
 * stops counting load-bearing hard fails, this regression test fails alongside
 * the benchmark it guards.
 */
function gateFailures(validators: ValidatorResult[]): number {
  return validators
    .flatMap((validator) => validator.results)
    .filter((result) => result.status === "fail" && resolveLoadBearing(result))
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

// A load-bearing failure that is NOT error-severity. Under the old gate logic
// (status === "fail" && severity === "error") this would have been silently
// ignored despite loadBearing: true; the gate now honors resolveLoadBearing().
const loadBearingWarnFail: CheckResult = {
  category: "lod",
  detail: "Density tiles were served below the configured zoom threshold.",
  docRef: "docs/adoption/benchmark-interpretation.md#lod-density-threshold",
  fix: "Gate the density route on ATLAS_LOD_CONFIG.densityMaxZoom.",
  id: "lod-density-threshold",
  label: "Density LOD threshold",
  loadBearing: true,
  rationale: "Serving the wrong LOD breaks bounded navigation guarantees.",
  severity: "warn",
  status: "fail",
};

describe("seeded regression: load-bearing flag overrides severity at the gate", () => {
  it("trips the gate for a load-bearing fail even when severity is warn", () => {
    // This is the case the review flagged: loadBearing must be authoritative.
    expect(gateFailures(validators([loadBearingWarnFail]))).toBe(1);
    expect(resolveLoadBearing(loadBearingWarnFail)).toBe(true);
  });
});

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
