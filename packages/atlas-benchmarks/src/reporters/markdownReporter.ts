import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { BenchmarkFinding, BenchmarkReport, CheckResult } from "../types";
import { createReportFindings } from "./findings";

function row(result: CheckResult): string {
  const measured = result.measured === undefined ? "" : String(result.measured);
  const budget = result.budget === undefined ? "" : String(result.budget);
  const sotaBudget =
    result.sotaBudget === undefined ? "" : String(result.sotaBudget);
  return [
    result.status,
    result.severity,
    result.category,
    result.label,
    measured,
    budget,
    sotaBudget,
    result.unit ?? "",
    result.detail.replace(/\|/g, "\\|"),
  ].join(" | ");
}

function findingLines(finding: BenchmarkFinding): string[] {
  const measured =
    finding.measured === undefined
      ? ""
      : ` measured ${finding.measured}${finding.unit ? ` ${finding.unit}` : ""}`;
  const budget =
    finding.budget === undefined
      ? ""
      : ` budget ${finding.budget}${finding.unit ? ` ${finding.unit}` : ""}`;
  const sota =
    finding.sotaBudget === undefined
      ? ""
      : ` SOTA ${finding.sotaBudget}${finding.unit ? ` ${finding.unit}` : ""}`;
  const lines = [`- ${finding.label}:${measured}${budget}${sota}. ${finding.detail}`];
  if (finding.rationale) lines.push(`  - Why: ${finding.rationale}`);
  if (finding.fix) lines.push(`  - Fix: ${finding.fix}`);
  if (finding.docRef) lines.push(`  - Doc: ${finding.docRef}`);
  return lines;
}

function section(title: string, rows: string[], empty: string): string[] {
  return [`## ${title}`, "", ...(rows.length > 0 ? rows : [`- ${empty}`]), ""];
}

export function createMarkdownReport(report: BenchmarkReport): string {
  const findings =
    report.findings ?? createReportFindings(report.validators);
  const lines = [
    "# Semantic Atlas Benchmark Report",
    "",
    `- Timestamp: ${report.meta.timestamp}`,
    `- Profile: ${report.meta.profile}`,
    `- Base URL: ${report.meta.baseUrl}`,
    `- Git commit: ${report.meta.gitCommit ?? "unknown"}`,
    `- Node: ${report.meta.node}`,
    `- Platform: ${report.meta.platform}`,
    `- Gate mode: ${report.meta.gate ? "yes" : "no"}`,
    "",
    "## Summary",
    "",
    `- Pass: ${report.summary.pass}`,
    `- Warn: ${report.summary.warn}`,
    `- Fail: ${report.summary.fail}`,
    `- Skip: ${report.summary.skip}`,
    `- Gate failures: ${report.summary.gateFailures}`,
    "",
    ...section(
      "Hard Failures",
      findings.hardFailures.flatMap(findingLines),
      "None.",
    ),
    ...section(
      "SOTA Misses",
      findings.sotaMisses.flatMap(findingLines),
      "None measured.",
    ),
    ...section(
      "Warnings And Skips",
      [...findings.warnings, ...findings.skipped].flatMap(findingLines),
      "None.",
    ),
    ...section(
      "Recommended Next Actions",
      findings.recommendedActions.map((action) => `- ${action}`),
      "No action generated.",
    ),
    "## Raw Results",
    "",
    "Status | Severity | Category | Check | Measured | Budget | SOTA | Unit | Detail",
    "--- | --- | --- | --- | ---: | ---: | ---: | --- | ---",
  ];

  for (const validator of report.validators) {
    lines.push(...validator.results.map(row));
    if (validator.skipped) {
      lines.push(
        [
          "skip",
          "warn",
          validator.validator,
          "validator skipped",
          "",
          "",
          "",
          validator.skipReason ?? "not available",
        ].join(" | "),
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

export function writeMarkdownReport(report: BenchmarkReport, path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, createMarkdownReport(report));
}
