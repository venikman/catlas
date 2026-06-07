# Semantic Atlas Benchmarks

This directory contains the local benchmark validator for the Semantic Atlas prototype.

The benchmark runner reports measured results and PASS/WARN/FAIL/SKIP checks. Gate-blocking checks are correctness and architecture failures only. Machine-dependent latency and payload-size targets are reported as warnings unless a hard safety cap is violated.

Budgets live in `benchmarks/budgets.ts` as `ATLAS_BUDGETS`, with both `good` and stricter `sota` thresholds for the Semantic Atlas scorecard.

## Commands

```bash
npm run bench:atlas:quick
npm run bench:atlas
npm run bench:atlas:full
npm run validate:atlas
```

Use `ATLAS_BASE_URL` to point at a running local app:

```bash
ATLAS_BASE_URL=http://localhost:3002 npm run bench:atlas:quick
```

The quality gate builds the app and starts a local production server when one is not already running:

```bash
npm run validate:atlas
```

You can do the same for a benchmark profile by passing `--start-server`. By default this starts the dev server:

```bash
npm run bench:atlas:quick -- --start-server
```

Use a production server after running `npm run build`:

```bash
npm run bench:atlas:quick -- --start-server --server=start
```

## Profiles

- `quick`: source invariants, LOD, API bounds, payload bounds, search, render smoke, database artifact checks.
- `standard`: quick checks plus interaction and memory architecture checks.
- `full`: standard checks plus scale-readiness simulation.

## Reports

The runner writes:

- `benchmarks/results/latest.json`
- `benchmarks/results/latest.md`

Generated reports are ignored by git. Keep `benchmarks/results/.gitkeep`.

Both reports include hard failures, SOTA misses, warnings/skips, recommended next actions, and raw result rows.

## Validator Scope

- LOD correctness: validates low/medium/high zoom decisions and low-zoom raw point rejection.
- API bounds: validates response status, p95 timing samples, row caps, payload observation, and stable invalid-query errors.
- Payload safety: validates aggregate payload targets, hard point payload cap, and no heavy point metadata in bulk lists.
- Search safety: validates bounded lightweight search results, excessive-limit clamping, payload size, and lazy entity detail loading.
- Source invariants: scans for server/client separation, centralized LOD/runtime config, and raw point guardrails.
- Render safety: verifies the current no-WebGL SVG renderer path, bounded runtime point inputs, browser console errors/warnings, failed browser requests, initial atlas API payload size, and initial raw-point fetch avoidance when Playwright can launch a browser.
- Database readiness: checks migrations, indexes, and representative EXPLAIN SQL; live DB timing runs only with `DATABASE_URL`.
- Scale readiness: simulates 10M constraints through aggregate LOD paths and hard high-zoom caps.

Browser frame-time, heap-growth, and screenshot comparisons are currently explicit SKIP/WARN checks until dedicated Playwright specs are wired. The quick render validator already captures browser console errors/warnings and failed network requests when a Playwright browser can launch.
