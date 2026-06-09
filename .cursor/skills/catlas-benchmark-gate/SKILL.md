---
name: catlas-benchmark-gate
description: >-
  Add repeatable local and CI benchmark commands for a Catlas adopter and run the
  right tier to produce a maturity-backed gate result. Runs Tier A
  ui-graph-evaluator first against any canvas/SVG host, and Tier B clickable audit
  only for semantic-atlas-compatible chrome. Validates against the existing M2
  mapping (examples/atlas-data-prep + npm run conformance). Use after
  catlas-adoption-scout, when a team needs evidence that their integration is
  bounded and rendering correctly.
---

# catlas-benchmark-gate

Turn an adopter's atlas integration into repeatable benchmark commands and a gate
result, then map that result to a maturity level using benchmark finding IDs.

Tiers, report paths, finding IDs, and the P/A/P review policy are canonical in
[`docs/atlas-adoption-maturity-plan.md`](../../../docs/atlas-adoption-maturity-plan.md),
[`docs/atlas-benchmarks.md`](../../../docs/atlas-benchmarks.md), and
[`packages/atlas-benchmarks/README.md`](../../../packages/atlas-benchmarks/README.md).
Decisions D1–D3 are in [`docs/adoption/CONTRACT.md`](../../../docs/adoption/CONTRACT.md).

## Preconditions

- The adopter app route is known and the app can be served at a known local URL.
- The package manager is known.
- A canvas/SVG graph surface exists (confirmed by `catlas-adoption-scout`).
- For M2 claims, a coordinate recipe and an `AtlasStore` implementation exist
  (D2); the M2 mapping is `examples/atlas-data-prep/coordinate-recipe.mjs` +
  `npm run conformance`.

## Allowed edits (path globs)

- `package.json` (scripts only) and lockfile updates needed for those scripts.
- `docs/**` adoption notes describing the commands and report paths.
- `**/.github/workflows/*.yml` CI example files for adopter-owned gates.
- `**/*.{json,jsonc,yml,yaml,mjs,cjs}` benchmark/selector **config** only (e.g.
  selector lists, gate thresholds). Do not edit renderer or validator source.

## Prohibited actions

- Never commit `.env`, generated production data, database dumps, or credentials.
- Never run destructive SQL such as `DROP TABLE`, `DELETE`, or `TRUNCATE`.
- Never point a benchmark or `DATABASE_URL` at an active production database — use
  a local seed DB, disposable container, or read-only staging replica only.
- Never edit renderer internals or validator source to make a gate pass; fix the
  data shape or bounded endpoint instead.
- Never claim M2 or higher without source-data evidence: a recipe that passes
  `npm run conformance` plus an `AtlasStore` implementation.
- Never report a maturity level whose required finding IDs were not emitted with
  `status: "pass"` (or an acceptable warn) — skipped is not passed.

## Stop conditions

- Stop after **3** route scans if no graph selector can be found; report back to
  `catlas-adoption-scout` rather than guessing selectors.
- Stop before running Tier B if the app does not implement semantic-atlas chrome
  (the Tier B selectors in the registry are absent).
- Stop and report "skipped" rather than fabricate a result if the local URL is
  unreachable or Playwright cannot launch a browser.

## Copy-paste validation commands

Tier A first — portable `ui-graph-evaluator` against any canvas/SVG host (this is
the M1/M4 graph-present gate; serve the consumer in another terminal first):

```bash
npm run build:packages
npm run example:atlas-consumer:build
npm run example:atlas-consumer:preview   # terminal 1

# terminal 2
npm run bench:ui -- \
  --url=http://127.0.0.1:4173 \
  --root-selector='[data-testid="consumer-root"]' \
  --graph-selector='[data-testid="semantic-atlas-map"]' \
  --overlay-selector='[data-atlas-kind="density-label"]' \
  --interaction=wheel-pan \
  --gate
```

M2 mapping — prove a non-TS pipeline yields in-bounds, contract-valid rows:

```bash
npm run conformance
```

Tier B — clickable audit, **only** for semantic-atlas-compatible chrome:

```bash
npm run bench:atlas:clickable -- --url=http://localhost:3002 --gate
```

Atlas-specific API/LOD/payload gate for reference-shell-compatible adopters:

```bash
npm run bench:atlas:quick -- --start-server --gate
```

## Output

Report: the commands run, the report paths
(UI evaluator → `benchmarks/results/ui-evaluator-latest.json`; atlas benchmark
runner → `outputs/atlas-benchmarks/latest.json` / `latest.md`), a
pass/warn/fail/skip interpretation, the finding IDs that
gate the claimed maturity level (e.g. `renderer-point-elements` and
`runtime-test-hook` for M1; the bounded-API source-invariant subset for M2), and
the highest maturity level the evidence actually supports.
