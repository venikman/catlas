import type { BenchmarkReport } from "../types";
import { createReportFindings } from "./findings";

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

  const redRows = report.validators
    .flatMap((validator) => validator.results)
    .filter((result) => result.status === "fail");
  if (redRows.length > 0) {
    console.log("Red rows (why / fix / doc):");
    for (const result of redRows) {
      const tag = result.severity === "error" ? "[load-bearing]" : "[advisory]";
      console.log(`- ${tag} ${result.label} (${result.id}): ${result.detail}`);
      if (result.rationale) console.log(`    Why: ${result.rationale}`);
      if (result.fix) console.log(`    Fix: ${result.fix}`);
      if (result.docRef) console.log(`    Doc: ${result.docRef}`);
    }
  }

  if (findings.recommendedActions.length > 0) {
    console.log("Recommended next actions:");
    for (const action of findings.recommendedActions) {
      console.log(`- ${action}`);
    }
  }
}
