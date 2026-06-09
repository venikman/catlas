# Semantic Atlas Benchmark Validator

The Semantic Atlas benchmark validator is a repeatable quality gate for the prototype as it moves from the current synthetic/demo scale toward 170k, 1M, and eventually 10M records.

It does not claim the app is "fast" without measurement. Each check is reported as `PASS`, `WARN`, `FAIL`, or `SKIP`. A gate failure is a `FAIL` on an architecture, LOD, API-bound, or safety check. Local latency budgets are reported as warnings because they vary by machine and active server state.

## How To Run

> **Paths & commands in this guide are relative to the reference app `apps/semantic-atlas/`** (where the `dev`/`atlas:*`/`generate:atlas` scripts live). From the repo root, prefix app scripts with `-w @catlas/semantic-atlas`. The benchmark tooling source lives in `packages/atlas-benchmarks/src/`.

For direct benchmark profile runs, start the atlas app first:

```bash
npm run dev -- --port 3002
```

Then run one of the benchmark profiles:

```bash
npm run bench:atlas:quick
npm run bench:atlas
npm run bench:atlas:full
```

Run the non-flaky quality gate:

```bash
npm run validate:atlas
```

The quality gate builds the app and starts a local production server automatically when one is not already running. Direct benchmark profile runs can start a dev server with `--start-server`:

```bash
npm run bench:atlas:quick -- --start-server
```

After `npm run build`, a direct benchmark can use the production server:

```bash
npm run bench:atlas:quick -- --start-server --server=start
```

Use another local URL when needed:

```bash
ATLAS_BASE_URL=http://localhost:3000 npm run bench:atlas:quick
```

## Profiles

`quick` is the local developer check. It runs source-invariant checks, LOD validation, bounded API checks, payload checks, search checks, render smoke checks, and database artifact checks.

`standard` is the pre-merge profile. It adds interaction and memory architecture checks. Browser-only latency and heap checks are marked as skipped until a browser benchmark dependency is installed.

`full` is the scale-readiness profile. It adds 10M simulation checks and verifies that the architecture stays on aggregate/density/cluster paths below high zoom.

## Reports

Every run writes:

- `outputs/atlas-benchmarks/latest.json`
- `outputs/atlas-benchmarks/latest.md`

The JSON report is intended for CI. The Markdown report is intended for humans. Benchmark result artifacts under `outputs/` are ignored by git. (The portable UI graph evaluator writes separately to `benchmarks/results/ui-evaluator-latest.json`.)

Reports include:

- hard failures that block `validate:atlas`
- SOTA misses that pass the gate but miss aspirational targets
- warnings and skipped checks
- recommended next actions generated from measured failures, warnings, and skips
- raw result rows with measured values, good budgets, and SOTA budgets

## Current Budgets

Budgets are centralized in `packages/atlas-benchmarks/src/budgets.ts` as `ATLAS_BUDGETS`. Each performance budget has a `good` threshold and a stricter `sota` target. The current validators use the `good` thresholds for compatibility, while the SOTA values are available for scorecard/reporting work.

Page-level guardrails:

- LCP: good `<= 2500 ms`, SOTA `<= 1500 ms`
- INP: good `<= 200 ms`, SOTA `<= 100 ms`
- CLS: good `<= 0.1`, SOTA `<= 0.03`
- first meaningful atlas render: good `<= 2500 ms`, SOTA `<= 1200 ms`

Runtime interaction and rendering targets:

- frame time p95: good `<= 32 ms`, SOTA `<= 20 ms`
- idle FPS: good `>= 50`, SOTA `>= 60`
- pan/zoom FPS p95: good `>= 45`, SOTA `>= 55`
- hover feedback: good `<= 100 ms`, SOTA `<= 50 ms`
- click-to-panel shell: good `<= 200 ms`, SOTA `<= 100 ms`

API p95 local targets:

- views: good `<= 100 ms`, SOTA `<= 50 ms`
- density: good `<= 250 ms`, SOTA `<= 120 ms`
- clusters: good `<= 250 ms`, SOTA `<= 120 ms`
- points: good `<= 300 ms`, SOTA `<= 150 ms`
- entity: good `<= 150 ms`, SOTA `<= 75 ms`
- search: good `<= 300 ms`, SOTA `<= 150 ms`

Live Postgres query p95 targets use the same starting thresholds under
`ATLAS_BUDGETS.dbP95Ms`. They are reported separately from API latency so route
overhead and query-plan regressions can be diagnosed independently.

Payload and row caps:

- initial atlas payload: good `<= 1 MB`, SOTA `<= 500 KB`
- density payload: good `<= 500 KB`, SOTA `<= 200 KB`
- cluster payload: good `<= 500 KB`, SOTA `<= 250 KB`
- high-zoom point payload: good hard cap `<= 2 MB`, SOTA target `<= 750 KB`
- entity payload: good `<= 100 KB`, SOTA `<= 25 KB`
- search payload: good `<= 100 KB`, SOTA `<= 25 KB`
- viewport points: `<= 20000`
- clusters: `<= 2000`
- search results: `<= 20`

The first-pass gate also has explicit hard caps for payloads that should fail only when the architecture becomes unsafe: initial atlas API payload `<= 2 MB` and high-zoom point payload `<= 5 MB`. The stricter good/SOTA targets are reported as warnings or SOTA misses.

Some compatibility values can be overridden through environment variables in `packages/atlas-benchmarks/src/budgets.ts`.

## What The Validator Checks

LOD correctness:

- low zoom resolves to density
- medium zoom resolves to clusters
- high zoom resolves to points
- low zoom raw point requests are rejected

API response bounds:

- endpoints return expected status codes
- invalid bbox/search inputs return a stable error shape
- point, cluster, density, and search row counts stay within app caps
- high-zoom point requests require bbox and cannot use oversized bbox spans

Payload safety:

- aggregate and point response sizes are measured
- high-zoom point payload has a hard cap
- bulk point lists do not include heavy metadata
- search results are lightweight and bounded
- excessive search limits are clamped to the configured max

Frontend/render safety:

- the current renderer initializes through the no-WebGL Canvas 2D texture plus SVG overlay path
- renderer test hooks are present
- high-zoom renderer inputs are bounded
- browser console errors/warnings and failed network requests are captured when Playwright can launch a browser
- screenshot/frame/heap checks remain explicit skips or warnings until dedicated browser specs are wired

Source-code architecture invariants:

- client components do not import server database code
- LOD thresholds are centralized
- raw point endpoint uses shared point-fetch guard
- raw point endpoint uses bbox validation
- bulk point responses use lightweight point shaping
- runtime and visual config are centralized
- API routes do not contain console logging spam

Database readiness:

- baseline and hardened migrations exist
- point bbox indexes exist
- cluster bounds index exists
- density bounds expression index exists
- trigram search index exists
- representative EXPLAIN SQL exists
- live DB connection, timing, row-bound, projection, and EXPLAIN-plan checks run only when `DATABASE_URL` is configured

For local setup, migration, seeding, and live DB benchmark commands, see:

```text
docs/atlas-postgres-benchmarks.md
```

Scale readiness:

- 10M is simulated through architecture constraints, not raw rendering
- low zoom uses density aggregates
- medium zoom uses clusters
- high zoom has hard point caps
- unsafe high-zoom bbox requests are rejected
- synthetic generator supports streamed/batched output

## Known Limitations

The current quick gate launches Playwright when a local browser is available and captures browser console errors/warnings, failed browser requests, initial raw-point fetch avoidance, initial atlas API payload size, and visible SVG bounds. It does not yet measure real browser FPS, heap growth, LCP, INP, or visual diffs. Those checks are represented as explicit skipped/warning checks and placeholder specs under `benchmarks/playwright/`.

The validator does not generate 1M records by default. Full-scale synthetic generation should remain opt-in because it can be slow and machine-dependent.

The 10M readiness check intentionally avoids rendering or transferring 10M raw points. It validates that the app cannot accidentally do that at low or medium zoom and that high-zoom point access is capped.

## Adding New Checks

Add a validator under `packages/atlas-benchmarks/src/validators/`, register it in `packages/atlas-benchmarks/src/validators/index.ts`, and include it in the relevant profile in `packages/atlas-benchmarks/src/benchmark.config.ts`.

Use `packages/atlas-benchmarks/src/budgets.ts` for thresholds. If a budget depends on local hardware, report it as `WARN`; if a budget protects architecture or boundedness, report it as gate-blocking `FAIL`.
