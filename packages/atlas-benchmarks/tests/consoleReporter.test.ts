import { afterEach, describe, expect, it, vi } from "vitest";
import { printConsoleReport } from "../src/reporters/consoleReporter";
import type { BenchmarkReport } from "../src/types";

function reportWithHardFailure(): BenchmarkReport {
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
    summary: { fail: 1, gateFailures: 1, pass: 0, skip: 0, warn: 0 },
    validators: [
      {
        validator: "source",
        results: [
          {
            category: "source",
            detail: "client module imports pg",
            id: "client-no-db-import",
            label: "Client bundle has no direct DB import",
            severity: "error",
            status: "fail",
            rationale:
              "shipping a DB driver to the browser leaks credentials and bloats the bundle",
            fix: "move the query behind the AtlasStore server boundary",
            docRef: "docs/adoption/CONTRACT.md#1-the-store-interface",
          },
        ],
      },
    ],
  };
}

describe("printConsoleReport", () => {
  afterEach(() => vi.restoreAllMocks());

  it("prints why/fix/doc for each red row", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "table").mockImplementation(() => {});

    printConsoleReport(reportWithHardFailure());

    const output = log.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(output).toContain("client-no-db-import");
    expect(output).toContain(
      "Why: shipping a DB driver to the browser leaks credentials",
    );
    expect(output).toContain(
      "Fix: move the query behind the AtlasStore server boundary",
    );
    expect(output).toContain("Doc: docs/adoption/CONTRACT.md#1-the-store-interface");
  });
});
