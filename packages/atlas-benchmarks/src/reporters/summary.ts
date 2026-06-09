import type { BenchmarkReport, ValidatorResult } from "../types";

/**
 * Roll validator results up into the report summary counts. `gateFailures`
 * counts only load-bearing failures (status "fail" + severity "error") — the
 * same predicate the runner uses to decide whether `--gate` blocks.
 */
export function summarize(
  validators: ValidatorResult[],
): BenchmarkReport["summary"] {
  const all = validators.flatMap((validator) => validator.results);
  return {
    fail: all.filter((result) => result.status === "fail").length,
    gateFailures: all.filter(
      (result) => result.status === "fail" && result.severity === "error",
    ).length,
    pass: all.filter((result) => result.status === "pass").length,
    skip: all.filter((result) => result.status === "skip").length,
    warn: all.filter((result) => result.status === "warn").length,
  };
}
