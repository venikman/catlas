# Semantic Atlas Benchmarks

This directory contains the local benchmark validator for the Semantic Atlas prototype.

The benchmark runner reports measured results and PASS/WARN/FAIL/SKIP checks. Gate-blocking checks are correctness and architecture failures only. Machine-dependent latency and payload-size targets are reported as warnings unless a hard safety cap is violated.

Budgets live in `src/budgets.ts` as `ATLAS_BUDGETS`, with both `good` and stricter `sota` thresholds for the Semantic Atlas scorecard.

## Commands

```bash
npm run bench:atlas:quick
npm run bench:atlas
npm run bench:atlas:full
npm run bench:atlas:clickable
npm run bench:ui -- --url=http://localhost:3002
npm run build:packages
npm run validate:atlas
```

Use `ATLAS_BASE_URL` to point at a running local app:

```bash
ATLAS_BASE_URL=http://localhost:3002 npm run bench:atlas:quick
```

Use the generic UI graph evaluator for another graph UI by passing selectors:

```bash
npm run bench:ui -- \
  --url=http://localhost:4173 \
  --root-selector='[data-testid="graph-root"]' \
  --graph-selector='canvas, svg' \
  --gate
```

The generic evaluator is intentionally not tied to `/api/atlas/*`. It checks page load, visible graph bounds, nonblank canvas/SVG rendering, sampled canvas texture coverage, sampled spatial texture, sampled hue variation, pan/zoom screenshot changes, optional overlay persistence, and console health, then writes `benchmarks/results/ui-evaluator-latest.json`. When the graph selector points at a layered container instead of a canvas or SVG, the evaluator falls back to graph-element screenshot texture checks. Coverage, spatial texture, and hue variation are warning-level graph-quality signals so sparse or monochrome graphs can still use the same evaluator.

The atlas-specific clickable audit exercises the example app controls and verifies observable state changes instead of trusting screenshots:

```bash
npm run bench:atlas:clickable -- \
  --url=http://localhost:3002 \
  --record-video \
  --gate
```

It clicks LOD buttons, zoom/home, top view buttons, layer toggles, search result selection, inspector close, cluster selection, and map wheel/pan. Placeholder controls must be disabled so the app does not expose fake click targets.

Use `--interaction=wheel`, `--interaction=pan`, or `--interaction=wheel-pan` to test map-like navigation. Add `--overlay-selector` when labels, contours, or other graph overlays should remain present after the interaction:

```bash
npm run bench:ui -- \
  --url=http://localhost:3002 \
  --graph-selector='[data-testid="atlas-map-canvas"]' \
  --overlay-selector='[data-testid="atlas-overlay"] [data-atlas-kind="density-label"]' \
  --interaction=wheel-pan \
  --min-overlay-count=3 \
  --gate
```

Run the built CLI help for the portable contract:

```bash
npm run build:packages
node packages/ui-graph-evaluator/dist/run-ui-evaluator.js --help
```

For visual evidence, add `--artifacts` to write `before.png` and `after.png`, or `--record-video` to also write `interaction.webm`:

```bash
npm run bench:ui -- \
  --url=http://localhost:4173 \
  --root-selector='[data-testid="graph-root"]' \
  --graph-selector='canvas, svg' \
  --artifacts \
  --record-video
```

Tune texture thresholds when auditing non-Catlas graph UIs. By default, texture threshold misses are warnings. Add `--strict-texture` when dense-map texture should be gate-blocking:

```bash
npm run bench:ui -- \
  --url=http://localhost:4173 \
  --graph-selector='canvas' \
  --interaction=wheel-pan \
  --min-coverage=0.04 \
  --min-hue-buckets=5 \
  --min-occupied-cells=120 \
  --strict-texture \
  --gate
```

Compare a graph against a visual reference image when you need a repeatable map-fidelity signal. The evaluator captures the graph element, profiles both images relative to their estimated light background, and reports a reference texture score:

```bash
npm run bench:ui -- \
  --url=http://localhost:3002 \
  --graph-selector='[data-testid="atlas-map-canvas"]' \
  --reference-image=/absolute/path/to/nomic-map-only.png \
  --min-reference-score=55 \
  --artifacts \
  --gate
```

Reference-score misses are warnings by default. Add `--strict-reference` to make the reference comparison gate-blocking.

If Playwright's bundled browser is not installed, pass `--browser-executable=/path/to/chrome` or set `UI_EVAL_BROWSER_EXECUTABLE`. On macOS, the evaluator also tries `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.

For package-style use, run `npm run build:packages` and execute:

```bash
node packages/ui-graph-evaluator/dist/run-ui-evaluator.js \
  --url=http://localhost:4173 \
  --root-selector='[data-testid="graph-root"]' \
  --graph-selector='canvas, svg' \
  --gate
```

The same CLI is also packaged separately as `@catlas/ui-graph-evaluator` after `npm run build:packages`.

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

The benchmark runner (`bench:atlas:*`) writes:

- `outputs/atlas-benchmarks/latest.json`
- `outputs/atlas-benchmarks/latest.md`

The portable UI graph evaluator (`bench:ui`) writes `benchmarks/results/ui-evaluator-latest.json` separately. Generated reports under `outputs/` and `benchmarks/results/` are ignored by git.

Both reports include hard failures, SOTA misses, warnings/skips, recommended next actions, and raw result rows.

## Validator Scope

- LOD correctness: validates low/medium/high zoom decisions and low-zoom raw point rejection.
- API bounds: validates response status, p95 timing samples, row caps, payload observation, and stable invalid-query errors.
- Payload safety: validates aggregate payload targets, hard point payload cap, and no heavy point metadata in bulk lists.
- Search safety: validates bounded lightweight search results, excessive-limit clamping, payload size, and lazy entity detail loading.
- Source invariants: scans for server/client separation, centralized LOD/runtime config, and raw point guardrails.
- Render safety: verifies the current no-WebGL Canvas 2D plus SVG overlay renderer path, bounded runtime point inputs, browser console errors/warnings, failed browser requests, initial atlas API payload size, nonblank canvas texture, and initial raw-point fetch avoidance when Playwright can launch a browser.
- Database readiness: checks migrations, indexes, and representative EXPLAIN SQL; live DB timing, row-bound, projection, and plan checks run only with `DATABASE_URL`.
- Scale readiness: simulates 10M constraints through aggregate LOD paths and hard high-zoom caps.

Browser frame-time, heap-growth, and screenshot comparisons are currently explicit SKIP/WARN checks until dedicated Playwright specs are wired. The quick render validator already captures browser console errors/warnings and failed network requests when a Playwright browser can launch.

Live Postgres benchmark setup is documented in `docs/atlas-postgres-benchmarks.md`.
