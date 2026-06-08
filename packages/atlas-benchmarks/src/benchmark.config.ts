import type { BenchmarkProfile } from "./types";

// Which validators run in each profile, plus run parameters.
export const BENCH_CONFIG = {
  baseUrl: process.env.ATLAS_BASE_URL || "http://localhost:3002",
  /** Falls back further to the first slug returned by /api/atlas/views at runtime. */
  defaultView: process.env.BENCH_VIEW || "research-domains",
  resultsDir: "outputs/atlas-benchmarks",
  warmupRequests: 2,
  repetitions: {
    quick: 5,
    standard: 20,
    full: 40,
  } as Record<BenchmarkProfile, number>,
  validatorsByProfile: {
    quick: ["sourceInvariant", "lod", "api", "payload", "search", "render", "dbQuery"],
    standard: [
      "sourceInvariant",
      "lod",
      "api",
      "payload",
      "search",
      "render",
      "interaction",
      "memory",
      "dbQuery",
    ],
    full: [
      "sourceInvariant",
      "lod",
      "api",
      "payload",
      "search",
      "render",
      "interaction",
      "memory",
      "dbQuery",
      "scale",
    ],
  } as Record<BenchmarkProfile, string[]>,
} as const;
