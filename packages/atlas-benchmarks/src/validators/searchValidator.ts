import { ATLAS_BUDGETS, BUDGETS } from "../budgets";
import { scenarioUrl } from "../scenarios";
import type { BenchmarkContext, CheckResult, ValidatorResult } from "../types";
import { percentiles } from "../types";
import { fail, isServerReachable, pass, skip, tryFetchJson, warn } from "./helpers";

type SearchResultRecord = {
  clusterId?: unknown;
  entityId?: unknown;
  entityType?: unknown;
  label?: unknown;
  metadata?: unknown;
  payloadSummary?: unknown;
  score?: unknown;
  x?: unknown;
  y?: unknown;
};

function searchResults(body: Record<string, unknown> | null): SearchResultRecord[] {
  return Array.isArray(body?.results) ? (body.results as SearchResultRecord[]) : [];
}

function stableErrorShape(body: Record<string, unknown> | null): boolean {
  return Boolean(
    body &&
      typeof body.error === "string" &&
      body.ok === false &&
      typeof body.status === "number",
  );
}

function resultIsLightweight(result: SearchResultRecord): boolean {
  return (
    typeof result.entityId === "string" &&
    typeof result.label === "string" &&
    typeof result.entityType === "string" &&
    typeof result.x === "number" &&
    typeof result.y === "number" &&
    typeof result.clusterId === "string" &&
    typeof result.score === "number" &&
    result.metadata === undefined &&
    result.payloadSummary === undefined
  );
}

export async function searchValidator(context: BenchmarkContext): Promise<ValidatorResult> {
  if (!(await isServerReachable(context.baseUrl))) {
    return {
      skipped: true,
      skipReason: `Server not reachable at ${context.baseUrl}.`,
      validator: "search",
      results: [
        skip(
          "search-server-unreachable",
          "search",
          "Search endpoint reachable",
          `Server not reachable at ${context.baseUrl}.`,
        ),
      ],
    };
  }

  const results: CheckResult[] = [];
  const searchScenario = {
    endpoint: "search" as const,
    expectStatus: 200,
    id: "search-bounded",
    label: "Search bounded result set",
    query: { limit: String(BUDGETS.bounds.maxSearchResults), q: "graph" },
  };
  const url = scenarioUrl(context.baseUrl, context.view, searchScenario);
  const timings: number[] = [];
  let last = await tryFetchJson(url);
  timings.push(last.ms);
  for (let index = 1; index < context.repetitions; index += 1) {
    last = await tryFetchJson(url);
    timings.push(last.ms);
  }

  const sample = percentiles(timings);
  const rows = searchResults(last.body);
  const count = Number(last.body?.count ?? rows.length);

  results.push(
    last.status === 200
      ? pass(
          "search-status",
          "search",
          "Search endpoint succeeds",
          `Status 200, p95 ${sample.p95} ms over ${sample.count} samples.`,
          {
            budget: BUDGETS.apiLatencyMsP95.search,
            comparison: "lte",
            measured: sample.p95,
            severity: "warn",
            sotaBudget: ATLAS_BUDGETS.apiP95Ms.search.sota,
            unit: "ms",
          },
        )
      : fail(
          "search-status",
          "search",
          "Search endpoint succeeds",
          `Expected status 200, received ${last.status}.`,
        ),
  );

  if (sample.p95 > BUDGETS.apiLatencyMsP95.search) {
    results.push(
      warn(
        "search-latency-p95",
        "search",
        "Search p95 latency",
        `Measured p95 ${sample.p95} ms; local budget ${BUDGETS.apiLatencyMsP95.search} ms.`,
        {
          budget: BUDGETS.apiLatencyMsP95.search,
          comparison: "lte",
          measured: sample.p95,
          sotaBudget: ATLAS_BUDGETS.apiP95Ms.search.sota,
          unit: "ms",
        },
      ),
    );
  }

  results.push(
    last.bytes <= ATLAS_BUDGETS.payloadBytes.search.good
      ? pass(
          "search-payload-size",
          "search",
          "Search payload size",
          `Search payload was ${last.bytes} bytes.`,
          {
            budget: ATLAS_BUDGETS.payloadBytes.search.good,
            comparison: "lte",
            measured: last.bytes,
            severity: "warn",
            sotaBudget: ATLAS_BUDGETS.payloadBytes.search.sota,
            unit: "bytes",
          },
        )
      : warn(
          "search-payload-size",
          "search",
          "Search payload size",
          `Search payload was ${last.bytes} bytes, above good target ${ATLAS_BUDGETS.payloadBytes.search.good}.`,
          {
            budget: ATLAS_BUDGETS.payloadBytes.search.good,
            comparison: "lte",
            measured: last.bytes,
            sotaBudget: ATLAS_BUDGETS.payloadBytes.search.sota,
            unit: "bytes",
          },
        ),
  );

  results.push(
    count <= BUDGETS.bounds.maxSearchResults
      ? pass(
          "search-result-bound",
          "search",
          "Search results are bounded",
          `Returned ${count} results with limit budget ${BUDGETS.bounds.maxSearchResults}.`,
          {
            budget: BUDGETS.bounds.maxSearchResults,
            measured: count,
            unit: "results",
          },
        )
      : fail(
          "search-result-bound",
          "search",
          "Search results are bounded",
          `Returned ${count} results, exceeding ${BUDGETS.bounds.maxSearchResults}.`,
          {
            budget: BUDGETS.bounds.maxSearchResults,
            measured: count,
            unit: "results",
          },
        ),
  );

  results.push(
    rows.every(resultIsLightweight)
      ? pass(
          "search-lightweight-payload",
          "search",
          "Search payload is lightweight",
          `Checked ${rows.length} result rows; none included metadata or payload summaries.`,
        )
      : fail(
          "search-lightweight-payload",
          "search",
          "Search payload is lightweight",
          "At least one search result row included missing coordinates or heavy metadata.",
        ),
  );

  const firstEntityId = rows.find((row) => typeof row.entityId === "string")?.entityId;
  if (typeof firstEntityId === "string") {
    const entity = await tryFetchJson(
      scenarioUrl(
        context.baseUrl,
        context.view,
        {
          endpoint: "entity",
          expectStatus: 200,
          id: "search-entity-detail",
          label: "Entity detail after search",
        },
        firstEntityId,
      ),
    );
    results.push(
      entity.status === 200 && Boolean(entity.body?.entity)
        ? pass(
            "search-entity-lazy-load",
            "search",
            "Entity metadata loads lazily",
            `Entity detail loaded separately in ${entity.ms} ms after search result selection.`,
            {
              budget: BUDGETS.apiLatencyMsP95.entity,
              comparison: "lte",
              measured: entity.ms,
              severity: "warn",
              sotaBudget: ATLAS_BUDGETS.apiP95Ms.entity.sota,
              unit: "ms",
            },
          )
        : fail(
            "search-entity-lazy-load",
            "search",
            "Entity metadata loads lazily",
          `Expected entity detail status 200 after search; received ${entity.status}.`,
        ),
    );
    if (entity.status === 200) {
      results.push(
        entity.bytes <= ATLAS_BUDGETS.payloadBytes.entity.good
          ? pass(
              "entity-payload-size",
              "search",
              "Entity payload size",
              `Entity detail payload was ${entity.bytes} bytes.`,
              {
                budget: ATLAS_BUDGETS.payloadBytes.entity.good,
                comparison: "lte",
                measured: entity.bytes,
                severity: "warn",
                sotaBudget: ATLAS_BUDGETS.payloadBytes.entity.sota,
                unit: "bytes",
              },
            )
          : warn(
              "entity-payload-size",
              "search",
              "Entity payload size",
              `Entity detail payload was ${entity.bytes} bytes, above good target ${ATLAS_BUDGETS.payloadBytes.entity.good}.`,
              {
                budget: ATLAS_BUDGETS.payloadBytes.entity.good,
                comparison: "lte",
                measured: entity.bytes,
                sotaBudget: ATLAS_BUDGETS.payloadBytes.entity.sota,
                unit: "bytes",
              },
            ),
      );
    }
  } else {
    results.push(
      warn(
        "search-entity-lazy-load",
        "search",
        "Entity metadata loads lazily",
        "Search returned no entity id, so entity detail lazy-load latency was not measured.",
      ),
    );
  }

  const invalid = await tryFetchJson(
    scenarioUrl(context.baseUrl, context.view, {
      endpoint: "search",
      expectStatus: 400,
      id: "invalid-search",
      label: "Invalid search rejected",
      query: { q: "x" },
    }),
  );
  results.push(
    invalid.status === 400 && stableErrorShape(invalid.body)
      ? pass(
          "search-invalid-reject",
          "search",
          "Invalid search is rejected",
          "One-character search returned status 400 with stable error shape.",
        )
      : fail(
          "search-invalid-reject",
          "search",
          "Invalid search is rejected",
          `Expected status 400 with stable error shape; received ${invalid.status}.`,
        ),
  );

  const unbounded = await tryFetchJson(
    scenarioUrl(context.baseUrl, context.view, {
      endpoint: "search",
      expectStatus: 200,
      id: "search-unbounded-clamp",
      label: "Excessive search limit clamped",
      query: { limit: "1000", q: "graph" },
    }),
  );
  const unboundedCount = Number(unbounded.body?.count ?? searchResults(unbounded.body).length);
  results.push(
    unbounded.status === 200 && unboundedCount <= BUDGETS.bounds.maxSearchResults
      ? pass(
          "search-excessive-limit-clamped",
          "search",
          "Excessive search limit is clamped",
          `limit=1000 returned ${unboundedCount} results with max ${BUDGETS.bounds.maxSearchResults}.`,
          {
            budget: BUDGETS.bounds.maxSearchResults,
            measured: unboundedCount,
            unit: "results",
          },
        )
      : fail(
          "search-excessive-limit-clamped",
          "search",
          "Excessive search limit is clamped",
          `Expected <= ${BUDGETS.bounds.maxSearchResults} results; got status ${unbounded.status} count ${unboundedCount}.`,
          {
            budget: BUDGETS.bounds.maxSearchResults,
            measured: unboundedCount,
            unit: "results",
          },
        ),
  );

  return { validator: "search", results };
}
