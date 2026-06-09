import { describe, expect, it } from "vitest";
import { createReportFindings } from "../src/reporters/findings";
import type { CheckResult, ValidatorResult } from "../src/types";

function vr(results: CheckResult[]): ValidatorResult {
  return { validator: "test", results };
}

describe("createReportFindings", () => {
  it("partitions checks into hard failures, warnings, and skips by status and severity", () => {
    const findings = createReportFindings([
      vr([
        { id: "a", category: "lod", label: "A", status: "fail", severity: "error", detail: "boom" },
        { id: "b", category: "api", label: "B", status: "warn", severity: "warn", detail: "slow" },
        { id: "c", category: "api", label: "C", status: "fail", severity: "warn", detail: "soft fail" },
        { id: "d", category: "db", label: "D", status: "skip", severity: "warn", detail: "no db" },
        { id: "e", category: "lod", label: "E", status: "pass", severity: "error", detail: "ok" },
      ]),
    ]);

    expect(findings.hardFailures.map((f) => f.id)).toEqual(["a"]);
    expect(findings.warnings.map((f) => f.id).sort()).toEqual(["b", "c"]);
    expect(findings.skipped.map((f) => f.id)).toEqual(["d"]);
  });

  it("carries rationale, fix, docRef, and severity from the check into the finding", () => {
    const findings = createReportFindings([
      vr([
        {
          id: "points-bbox-validation",
          category: "source",
          label: "Points route validates bbox",
          status: "fail",
          severity: "error",
          detail: "route does not validate bbox",
          rationale: "an unbounded bbox lets an anonymous client scan the whole view",
          fix: "call parseAtlasBboxParams before querying the store",
          docRef: "docs/adoption/CONTRACT.md#5-the-field-boundary",
        },
      ]),
    ]);

    const finding = findings.hardFailures[0];
    expect(finding.rationale).toBe(
      "an unbounded bbox lets an anonymous client scan the whole view",
    );
    expect(finding.fix).toBe("call parseAtlasBboxParams before querying the store");
    expect(finding.docRef).toBe("docs/adoption/CONTRACT.md#5-the-field-boundary");
    expect(finding.severity).toBe("error");
  });

  it("surfaces a seeded load-bearing regression as a gate-blocking hard failure", () => {
    const findings = createReportFindings([
      vr([
        {
          id: "client-no-db-import",
          category: "source",
          label: "Client bundle has no direct DB import",
          status: "fail",
          severity: "error",
          detail: "client module imports pg",
        },
      ]),
    ]);

    expect(findings.hardFailures).toHaveLength(1);
    expect(findings.hardFailures[0].id).toBe("client-no-db-import");
  });
});
