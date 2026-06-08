import { describe, expect, it } from "vitest";
import { createMarkdownReport } from "../src/reporters/markdownReporter";
import type { BenchmarkReport } from "../src/types";

describe("benchmark markdown reporter", () => {
  it("renders summary and measured rows", () => {
    const report: BenchmarkReport = {
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
        fail: 0,
        gateFailures: 0,
        pass: 1,
        skip: 0,
        warn: 0,
      },
      validators: [
        {
          validator: "lod",
          results: [
            {
              category: "lod",
              detail: "Measured p95 42 ms.",
              id: "lod-test",
              label: "LOD check",
              measured: 42,
              severity: "error",
              status: "pass",
              unit: "ms",
            },
          ],
        },
      ],
    };

    const markdown = createMarkdownReport(report);

    expect(markdown).toContain("# Semantic Atlas Benchmark Report");
    expect(markdown).toContain("- Profile: quick");
    expect(markdown).toContain("- Gate failures: 0");
    expect(markdown).toContain("pass | error | lod | LOD check | 42");
  });
});
