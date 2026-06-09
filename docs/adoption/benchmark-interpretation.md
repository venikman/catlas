# Benchmark Interpretation

How to read the output of `@catlas/atlas-benchmarks` (and the portable
`@catlas/ui-graph-evaluator`), and what to do about each finding. The benchmark
reporters print a **Why / Fix / Doc** block under every non-passing row; the
`Doc` link points back into the relevant section below.

Canonical companions: [`docs/atlas-benchmarks.md`](../atlas-benchmarks.md) (command
reference) and [`packages/atlas-benchmarks/README.md`](../../packages/atlas-benchmarks/README.md)
(validator catalog). This doc is the *interpretation* layer the adoption plan
([`atlas-adoption-maturity-plan.md`](../atlas-adoption-maturity-plan.md)) routes to.

## Status legend

| Status | Meaning | Action |
| --- | --- | --- |
| **PASS** | The check ran and met its budget/invariant. | None. |
| **WARN** | Advisory: a soft target was missed or a machine-dependent metric is high. | Investigate, but it does **not** block `--gate`. |
| **FAIL** | A check did not meet its budget or invariant. | Blocks `--gate` **iff the check is load-bearing** (see below). |
| **SKIP** | The check could not run (server/DB unreachable, missing fixture). | Provide the missing precondition before claiming the maturity level it supports. |

## Load-bearing vs advisory

Every check carries a `loadBearing` flag (defaulting to `severity === "error"`).
The quality gate (`--gate`) counts a failure as gate-blocking only when the check
is **load-bearing** — correctness/architecture/bounds invariants. Latency,
payload-size soft targets, and console-warning checks are **advisory**: reported,
never gate-blocking. `resolveLoadBearing()` is the single source of truth, consumed
by `summarize()` in `run-benchmarks.ts`, so a `loadBearing: true` check blocks the
gate even at `warn` severity.

## Reference-score interpretation (UI evaluator)

- **> 70** — strong visual-texture fidelity; safe baseline for `--min-reference-score`.
- **50–70** — acceptable for early integration; review density data before pinning a floor.
- **< 50** — review density payloads, canvas rendering, or the chosen baseline before gating on the score.

## Maturity mapping

Findings gate maturity claims per the plan's Review Policy: M1 needs
`renderer-point-elements` + `runtime-test-hook`; M2 needs `client-no-db-import`,
`lod-thresholds-centralized`, `points-bbox-validation`, `points-no-bulk-metadata`;
M4 needs the full source-invariant set plus the `payload-*` checks under budget.

---

# Finding reference

## Source invariants

### client-no-db-import
**What:** No client bundle imports the database/`pg` layer. **Why:** keeps secrets and
the data driver out of the browser and preserves the modular `AtlasStore` boundary.
**Fix:** move data access behind the store / server routes; never import `db`/`pg` from a client component.

### lod-thresholds-centralized
**What:** LOD zoom thresholds come from one shared config, not scattered literals. **Why:**
renderer, routes, tiler, and recipe must agree on band boundaries. **Fix:** import
`ATLAS_LOD_CONFIG` / `getLodForZoom` instead of hardcoding `3` / `6` / `6.01`.

### lod-config-central
**What:** The LOD config object is defined once and re-exported. **Why:** prevents drift
between the package and the reference app. **Fix:** consume `@catlas/atlas-react/lod`; do not redeclare thresholds.

### runtime-config-centralized
**What:** Caps, TTLs, and limits resolve from one runtime config. **Why:** bounds and cache
policy must be auditable in one place. **Fix:** read from `ATLAS_RUNTIME_CONFIG` rather than per-route constants.

### points-bbox-validation
**What:** The points route validates and bounds its bbox before querying. **Why:** an
unbounded bbox lets a single request scan the whole corpus. **Fix:** validate params and reject/clamp out-of-range bboxes.

### points-low-zoom-guard
**What:** Raw point queries are rejected below the points zoom band. **Why:** low-zoom
must use density/cluster aggregates, never raw scans. **Fix:** gate the points route on `shouldFetchPoints(zoom)`.

### points-no-bulk-metadata
**What:** Point list rows omit heavy metadata/`payloadSummary`. **Why:** keeps high-zoom
payloads small; heavy fields belong behind entity lookup. **Fix:** shape rows with `lightweightPoint`.

### renderer-point-elements
**What:** The renderer does not mount one React element per point. **Why:** per-point
components blow up the DOM and GC at scale. **Fix:** render points to Canvas/WebGL under strict viewport caps.

### search-cap-bounded
**What:** Search bounds its candidate scan and result count. **Why:** an unbounded `ILIKE`
on a hot query can scan the whole table. **Fix:** cap the candidate subset (with a deterministic order) and the result limit.

## LOD thresholds

### lod-density-threshold
**What:** Density tiles serve below the density max-zoom. **Why:** wrong-LOD responses break
bounded navigation. **Fix:** gate the density route on `ATLAS_LOD_CONFIG.densityMaxZoom`.

### lod-cluster-threshold
**What:** Clusters serve only within the cluster zoom band. **Why:** clusters at the wrong
zoom either over-fetch or under-inform. **Fix:** serve clusters between density and points bands per the shared config.

### lod-point-threshold
**What:** Raw points serve only at/above the points min-zoom. **Why:** points below the band
mean unbounded scans. **Fix:** enforce `pointsMinZoom` from the shared LOD config.

## Payload budgets

### payload-density-size
**What (advisory):** Density payload under its soft target. **Why:** the lowest-zoom first
paint depends on a small density payload. **Fix:** aggregate density into a coarser grid / fewer tiles.

### payload-clusters-size
**What (advisory):** Cluster payload under its soft target. **Why:** mid-zoom navigation
stays responsive only with bounded cluster payloads. **Fix:** lower representative counts or trim cluster DTOs.

### payload-points-hard-cap
**What (load-bearing):** High-zoom points payload under its hard cap. **Why:** exceeding the
cap stalls the renderer and exhausts memory. **Fix:** enforce the per-response point cap and viewport bbox in the points route.

### payload-points-no-metadata
**What (load-bearing):** Point responses carry no heavy metadata. **Why:** bulk metadata at
high zoom defeats the lightweight contract. **Fix:** project rows through `lightweightPoint`; keep metadata behind `getEntity`.

## Render (browser)

### render-browser-console-errors
**What (load-bearing):** No console errors during a render pass. **Why:** errors indicate
broken rendering or data contracts. **Fix:** resolve the logged error before trusting the render.

### render-browser-console-warnings
**What (advisory):** No console warnings during a render pass. **Why:** warnings can signal
React keys, hydration, or deprecated-API issues. **Fix:** investigate before using screenshots as visual baselines.

### render-initial-no-points-fetch
**What (load-bearing):** The initial low-zoom render does not fetch raw points. **Why:** the
first paint must use density, not a point scan. **Fix:** ensure the initial viewport resolves to the density LOD.
