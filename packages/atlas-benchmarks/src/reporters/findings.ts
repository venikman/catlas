import type {
  BenchmarkFinding,
  BenchmarkReportFindings,
  CheckResult,
  ValidatorResult,
} from "../types";

function finding(result: CheckResult): BenchmarkFinding {
  return {
    budget: result.budget,
    category: result.category,
    detail: result.detail,
    docRef: result.docRef,
    fix: result.fix,
    id: result.id,
    label: result.label,
    measured: result.measured,
    rationale: result.rationale,
    sotaBudget: result.sotaBudget,
    unit: result.unit,
  };
}

export function isSotaMiss(result: CheckResult): boolean {
  if (result.measured === undefined || result.sotaBudget === undefined) {
    return false;
  }

  if (result.comparison === "gte") {
    return result.measured < result.sotaBudget;
  }

  return result.measured > result.sotaBudget;
}

function hasId(results: CheckResult[], id: string): boolean {
  return results.some((result) => result.id === id);
}

export function createReportFindings(
  validators: ValidatorResult[],
): BenchmarkReportFindings {
  const results = validators.flatMap((validator) => validator.results);
  const hardFailures = results
    .filter((result) => result.status === "fail" && result.severity === "error")
    .map(finding);
  const warnings = results
    .filter(
      (result) =>
        result.status === "warn" ||
        (result.status === "fail" && result.severity === "warn"),
    )
    .map(finding);
  const skipped = results.filter((result) => result.status === "skip").map(finding);
  const sotaMisses = results.filter(isSotaMiss).map(finding);

  const recommendedActions: string[] = [];
  if (hardFailures.length > 0) {
    recommendedActions.push(
      "Resolve gate-blocking architecture, LOD, and boundedness failures before visual polish.",
    );
  }
  if (hasId(results, "renderer-point-elements")) {
    recommendedActions.push(
      "Keep Canvas 2D point rendering under strict viewport caps, or move to a tiled/binary renderer before raising point limits.",
    );
  }
  if (
    sotaMisses.some(
      (miss) => miss.category === "payload" || miss.id.includes("payload"),
    )
  ) {
    recommendedActions.push(
      "Reduce SOTA payload misses by trimming bulk DTOs, tightening viewport bboxes, or lowering representative counts.",
    );
  }
  if (
    sotaMisses.some(
      (miss) => miss.category === "api" || miss.category === "search",
    )
  ) {
    recommendedActions.push(
      "Profile any API p95 SOTA misses with the route timing fields and database EXPLAIN scripts.",
    );
  }
  if (skipped.some((skip) => skip.id === "db-live-query-skip")) {
    recommendedActions.push(
      "Run the benchmark with DATABASE_URL configured before production database hardening decisions.",
    );
  }
  if (hasId(results, "render-browser-console-warnings")) {
    const warning = results.find(
      (result) =>
        result.id === "render-browser-console-warnings" &&
        result.status === "warn",
    );
    if (warning) {
      recommendedActions.push(
        "Investigate browser console warnings before using screenshots as visual baselines.",
      );
    }
  }
  if (hardFailures.length === 0) {
    recommendedActions.push(
      "Proceed to visual fidelity polish with validate:atlas kept as the local safety gate.",
    );
  }

  return {
    hardFailures,
    recommendedActions: recommendedActions.slice(0, 5),
    skipped,
    sotaMisses,
    warnings,
  };
}
