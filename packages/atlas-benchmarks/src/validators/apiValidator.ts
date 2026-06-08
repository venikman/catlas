import { ATLAS_BUDGETS, BUDGETS } from "../budgets";
import {
  NEGATIVE_SCENARIOS,
  POSITIVE_SCENARIOS,
  scenarioUrl,
  type ApiScenario,
} from "../scenarios";
import type { BenchmarkContext, CheckResult, ValidatorResult } from "../types";
import { percentiles } from "../types";
import { fail, isServerReachable, pass, skip, tryFetchJson, warn } from "./helpers";

function endpointBudget(endpoint: ApiScenario["endpoint"]): number | undefined {
  if (endpoint === "views") return BUDGETS.apiLatencyMsP95.views;
  if (endpoint === "density") return BUDGETS.apiLatencyMsP95.density;
  if (endpoint === "clusters") return BUDGETS.apiLatencyMsP95.clusters;
  if (endpoint === "points") return BUDGETS.apiLatencyMsP95.points;
  if (endpoint === "entity") return BUDGETS.apiLatencyMsP95.entity;
  if (endpoint === "search") return BUDGETS.apiLatencyMsP95.search;
  return undefined;
}

function endpointSotaBudget(endpoint: ApiScenario["endpoint"]): number | undefined {
  if (endpoint === "views") return ATLAS_BUDGETS.apiP95Ms.views.sota;
  if (endpoint === "density") return ATLAS_BUDGETS.apiP95Ms.density.sota;
  if (endpoint === "clusters") return ATLAS_BUDGETS.apiP95Ms.clusters.sota;
  if (endpoint === "points") return ATLAS_BUDGETS.apiP95Ms.points.sota;
  if (endpoint === "entity") return ATLAS_BUDGETS.apiP95Ms.entity.sota;
  if (endpoint === "search") return ATLAS_BUDGETS.apiP95Ms.search.sota;
  return undefined;
}

function rowLimit(endpoint: ApiScenario["endpoint"]): number | undefined {
  if (endpoint === "density") return BUDGETS.bounds.maxDensityTilesPerResponse;
  if (endpoint === "clusters") return BUDGETS.bounds.maxClustersPerResponse;
  if (endpoint === "points") return BUDGETS.bounds.maxPointsPerResponse;
  if (endpoint === "search") return BUDGETS.bounds.maxSearchResults;
  return undefined;
}

function stableErrorShape(body: Record<string, unknown> | null): boolean {
  return Boolean(
    body &&
      typeof body.error === "string" &&
      body.ok === false &&
      typeof body.status === "number",
  );
}

export async function apiValidator(context: BenchmarkContext): Promise<ValidatorResult> {
  if (!(await isServerReachable(context.baseUrl))) {
    return {
      skipped: true,
      skipReason: `Server not reachable at ${context.baseUrl}. Start the app or set ATLAS_BASE_URL.`,
      validator: "api",
      results: [
        skip(
          "api-server-unreachable",
          "api",
          "API server reachable",
          `Server not reachable at ${context.baseUrl}.`,
        ),
      ],
    };
  }

  const results: CheckResult[] = [];

  for (const scenario of POSITIVE_SCENARIOS) {
    const timings: number[] = [];
    let lastBody: Record<string, unknown> | null = null;
    let lastBytes = 0;
    let lastStatus = 0;
    const url = scenarioUrl(context.baseUrl, context.view, scenario);

    for (let index = 0; index < context.repetitions; index += 1) {
      const result = await tryFetchJson(url);
      timings.push(result.ms);
      lastBody = result.body;
      lastBytes = result.bytes;
      lastStatus = result.status;
    }

    const sample = percentiles(timings);
    const budget = endpointBudget(scenario.endpoint);
    const sotaBudget = endpointSotaBudget(scenario.endpoint);
    const limit = rowLimit(scenario.endpoint);
    const count = Number(lastBody?.count ?? 0);

    results.push(
      lastStatus === scenario.expectStatus
        ? pass(
            `api-${scenario.id}-status`,
            "api",
            `${scenario.label} status`,
            `Status ${lastStatus}, p95 ${sample.p95} ms over ${sample.count} samples.`,
            {
              budget,
              comparison: "lte",
              measured: sample.p95,
              severity: "warn",
              sotaBudget,
              unit: "ms",
            },
          )
        : fail(
            `api-${scenario.id}-status`,
            "api",
            `${scenario.label} status`,
            `Expected ${scenario.expectStatus}, received ${lastStatus}.`,
          ),
    );

    if (budget !== undefined && sample.p95 > budget) {
      results.push(
        warn(
          `api-${scenario.id}-latency`,
          "api",
          `${scenario.label} p95 latency`,
          `Measured p95 ${sample.p95} ms over ${sample.count} samples; local budget ${budget} ms.`,
          {
            budget,
            comparison: "lte",
            measured: sample.p95,
            sotaBudget,
            unit: "ms",
          },
        ),
      );
    }

    if (limit !== undefined) {
      results.push(
        count <= limit
          ? pass(
              `api-${scenario.id}-bounds`,
              "api",
              `${scenario.label} row bound`,
              `Returned ${count} rows with limit budget ${limit}.`,
              { budget: limit, measured: count, unit: "rows" },
            )
          : fail(
              `api-${scenario.id}-bounds`,
              "api",
              `${scenario.label} row bound`,
              `Returned ${count} rows, exceeding limit budget ${limit}.`,
              { budget: limit, measured: count, unit: "rows" },
            ),
      );
    }

    results.push(
      pass(
        `api-${scenario.id}-payload-observed`,
        "api",
        `${scenario.label} payload measured`,
        `Payload was ${lastBytes} bytes.`,
        { measured: lastBytes, severity: "warn", unit: "bytes" },
      ),
    );
  }

  for (const scenario of NEGATIVE_SCENARIOS) {
    const result = await tryFetchJson(scenarioUrl(context.baseUrl, context.view, scenario));
    results.push(
      result.status === scenario.expectStatus && stableErrorShape(result.body)
        ? pass(
            `api-${scenario.id}-reject`,
            "api",
            scenario.label,
            `Rejected with status ${result.status} and stable error shape.`,
          )
        : fail(
            `api-${scenario.id}-reject`,
            "api",
            scenario.label,
            `Expected status ${scenario.expectStatus} and stable error shape; got ${result.status}.`,
          ),
    );
  }

  return { validator: "api", results };
}
