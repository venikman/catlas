import type { BenchmarkFinding, BenchmarkReport } from "../types";
import { createReportFindings } from "./findings";

function printTeachBlocks(title: string, findings: BenchmarkFinding[]): void {
  const teachable = findings.filter(
    (finding) => finding.rationale || finding.fix || finding.docRef,
  );
  if (teachable.length === 0) return;
  console.log(title);
  for (const finding of teachable) {
    console.log(`- ${finding.label}`);
    if (finding.rationale) console.log(`  Why: ${finding.rationale}`);
    if (finding.fix) console.log(`  Fix: ${finding.fix}`);
    if (finding.docRef) console.log(`  Doc: ${finding.docRef}`);
  }
}

export function printConsoleReport(report: BenchmarkReport): void {
  const findings =
    report.findings ?? createReportFindings(report.validators);
  console.log(
    `Semantic Atlas benchmarks: profile=${report.meta.profile} base=${report.meta.baseUrl}`,
  );
  console.log(
    `pass=${report.summary.pass} warn=${report.summary.warn} fail=${report.summary.fail} skip=${report.summary.skip} gateFailures=${report.summary.gateFailures}`,
  );
  console.log(
    `hardFailures=${findings.hardFailures.length} sotaMisses=${findings.sotaMisses.length} warnings=${findings.warnings.length} skipped=${findings.skipped.length}`,
  );

  const rows = report.validators.flatMap((validator) =>
    validator.results.map((result) => ({
      budget: result.budget ?? "",
      category: result.category,
      check: result.label,
      detail: result.detail,
      measured: result.measured ?? "",
      severity: result.severity,
      sota: result.sotaBudget ?? "",
      status: result.status,
      validator: validator.validator,
    })),
  );
  console.table(rows);

  printTeachBlocks("Hard failures (why/fix/doc):", findings.hardFailures);
  printTeachBlocks("Warnings (why/fix/doc):", findings.warnings);

  if (findings.recommendedActions.length > 0) {
    console.log("Recommended next actions:");
    for (const action of findings.recommendedActions) {
      console.log(`- ${action}`);
    }
  }
}
