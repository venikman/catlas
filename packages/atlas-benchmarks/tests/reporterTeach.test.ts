import { describe, expect, it } from "vitest";
import { createMarkdownReport } from "../src/reporters/markdownReporter";
import type { BenchmarkReport, CheckResult } from "../src/types";

function reportWith(result: CheckResult): BenchmarkReport {
  return {
    meta: {
      baseUrl: "http://localhost:3002",
      gate: true,
      gitCommit: "abc123",
      node: "v25.0.0",
      platform: "darwin arm64",
      profile: "quick",
      timestamp: "2026-06-06T00:00:00.000Z",
    },
    summary: {
      fail: result.status === "fail" ? 1 : 0,
      gateFailures:
        result.status === "fail" && result.severity === "error" ? 1 : 0,
      pass: result.status === "pass" ? 1 : 0,
      skip: 0,
      warn: 0,
    },
    validators: [{ results: [result], validator: "test" }],
  };
}

describe("markdown reporter teach output", () => {
  it("prints Why/Fix/Doc sub-lines for a failing finding", () => {
    const markdown = createMarkdownReport(
      reportWith({
        category: "payload",
        detail: "Points payload was 9000000 bytes, above hard cap 5000000.",
        docRef: "docs/adoption/benchmark-interpretation.md#payload-points-hard-cap",
        fix: "Enforce the per-response point cap and viewport bbox.",
        id: "payload-points-hard-cap",
        label: "High-zoom points payload hard cap",
        rationale: "Exceeding the hard cap stalls the renderer.",
        severity: "error",
        status: "fail",
      }),
    );

    expect(markdown).toContain("  - Why: Exceeding the hard cap stalls the renderer.");
    expect(markdown).toContain(
      "  - Fix: Enforce the per-response point cap and viewport bbox.",
    );
    expect(markdown).toContain(
      "  - Doc: docs/adoption/benchmark-interpretation.md#payload-points-hard-cap",
    );
  });

  it("omits Why/Fix/Doc sub-lines when teach fields are absent", () => {
    const markdown = createMarkdownReport(
      reportWith({
        category: "payload",
        detail: "Points payload was 9000000 bytes, above hard cap 5000000.",
        id: "payload-points-hard-cap",
        label: "High-zoom points payload hard cap",
        severity: "error",
        status: "fail",
      }),
    );

    expect(markdown).not.toContain("  - Why:");
    expect(markdown).not.toContain("  - Fix:");
    expect(markdown).not.toContain("  - Doc:");
    // The finding itself is still rendered in the Hard Failures section.
    expect(markdown).toContain("- High-zoom points payload hard cap:");
  });
});
