// Shared types for the atlas benchmark/validation harness.

export type CheckStatus = "pass" | "warn" | "fail" | "skip";

/**
 * Severity decides whether a failed check blocks the quality gate.
 * - "error": architecture/LOD/bounds correctness — gate-blocking on fail.
 * - "warn":  latency/payload-size/machine-dependent — reported, never blocks.
 */
export type CheckSeverity = "error" | "warn";

export interface CheckResult {
  id: string;
  category: string;
  label: string;
  status: CheckStatus;
  severity: CheckSeverity;
  /** Human-readable detail; never a vague claim — include the measurement. */
  detail: string;
  /** Optional measured value + budget for the report table. */
  measured?: number;
  budget?: number;
  /** Optional aspirational SOTA budget used for scorecard warnings. */
  sotaBudget?: number;
  /** Defaults to "lte": measured value should be <= budget. */
  comparison?: "lte" | "gte";
  unit?: string;
  /** Teach metadata — why this check matters; surfaced for red rows. */
  rationale?: string;
  /** Teach metadata — the concrete fix to apply when this check is red. */
  fix?: string;
  /** Teach metadata — pointer to the canonical doc/section. */
  docRef?: string;
}

export interface BenchmarkContext {
  baseUrl: string;
  gate: boolean;
  profile: BenchmarkProfile;
  repetitions: number;
  validators: string[];
  view: string;
}

export type BenchmarkValidator = (
  context: BenchmarkContext,
) => Promise<ValidatorResult> | ValidatorResult;

export interface ValidatorResult {
  validator: string;
  results: CheckResult[];
  /** True when the validator could not run (e.g. server/DB unavailable). */
  skipped?: boolean;
  skipReason?: string;
}

export type BenchmarkProfile = "quick" | "standard" | "full";

export interface BenchmarkRunMeta {
  profile: BenchmarkProfile;
  timestamp: string;
  gitCommit: string | null;
  node: string;
  platform: string;
  baseUrl: string;
  gate: boolean;
}

export interface BenchmarkReport {
  meta: BenchmarkRunMeta;
  findings?: BenchmarkReportFindings;
  validators: ValidatorResult[];
  summary: {
    pass: number;
    warn: number;
    fail: number;
    skip: number;
    gateFailures: number;
  };
}

export interface BenchmarkFinding {
  id: string;
  category: string;
  label: string;
  detail: string;
  measured?: number;
  budget?: number;
  sotaBudget?: number;
  unit?: string;
  /** "error" = load-bearing (gate-blocking); "warn" = advisory. */
  severity?: CheckSeverity;
  /** Why this check matters. */
  rationale?: string;
  /** The concrete fix to apply when this check is red. */
  fix?: string;
  /** Pointer to the canonical doc/section. */
  docRef?: string;
}

export interface BenchmarkReportFindings {
  hardFailures: BenchmarkFinding[];
  warnings: BenchmarkFinding[];
  skipped: BenchmarkFinding[];
  sotaMisses: BenchmarkFinding[];
  recommendedActions: string[];
}

/** A timing sample set with computed percentiles. */
export interface LatencySample {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
}

export function percentiles(values: number[]): LatencySample {
  if (values.length === 0) {
    return { count: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  return {
    count: sorted.length,
    p50: round(at(50)),
    p95: round(at(95)),
    p99: round(at(99)),
    min: round(sorted[0]),
    max: round(sorted[sorted.length - 1]),
  };
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}
