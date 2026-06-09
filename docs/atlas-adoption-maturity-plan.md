# Atlas Adoption Maturity Plan

## Objective

Make Catlas adoptable by other products that need to render real semantic-map data, validate their graph UI with benchmark tooling, and produce evidence that the integration is bounded, styled correctly, and ready for production hardening.

Package adoption is already proven by the repository (see Maturity Model below), so this is **skills-first**: the leading deliverable is a minimum agent skill kit that an adopter can run against their own repo, not another tier of prose. The documentation spine and examples follow the skills.

The current repository proves the core ability through:

- `@catlas/atlas-react`: reusable React renderer that accepts shaped atlas data.
- `@catlas/ui-graph-evaluator`: portable graph UI evaluator for any canvas or SVG host.
- `@catlas/atlas-benchmarks`: atlas-specific API, LOD, render, and clickable audit gates.
- `@catlas/semantic-atlas`: Next.js + Postgres reference integration.
- `examples/atlas-consumer`: minimal Vite consumer that imports only the renderer.
- `examples/atlas-data-prep`: dependency-free coordinate recipe + `npm run conformance` proving a non-TS pipeline can produce contract-valid rows.

## Locked decisions (fold-in)

These three decisions are canonical in [`docs/adoption/CONTRACT.md`](adoption/CONTRACT.md) (pinned at `ATLAS_CONTRACT_VERSION`). They reshape the whole plan, so they sit at the top:

- **D1 — access control is upstream.** The atlas layer assumes the caller is already authorized by the host app. P1 is therefore not "add auth"; it is "control which fields cross the boundary (`sec-1`) and bound the search (`sec-2`)."
- **D2 — data access is modular.** Adopters implement the `AtlasStore` interface (7 methods) against their own database; the reference app ships Postgres + demo stores. `AtlasStore` is the central adoption artifact.
- **D3 — HTTP serving is a recommendation.** Adopters may call the store directly (the reference routes read through `getAtlasStore()`) or — once it ships — wrap it in the proposed `createAtlasRoutes({ store })` helper. The reference routes are one option, not a mandate.

Changing any of these is a contract change → bump `ATLAS_CONTRACT_VERSION` and notify the slice owners.

## Maturity Model

M0 and M1 are **baseline-done**: the repo already runs the demo and renders shaped data through the published package, so adopters inherit them. The first thing an adopter *produces* is a **working skill run** (M1→M2). "Required evidence" is adoption-centric — what an adopter shows — and references benchmark finding IDs where a gate proves the claim (see Review Policy).

| Level | Name | Promise | Required evidence (what the adopter shows) |
| --- | --- | --- | --- |
| M0 | Demo baseline — **baseline-done** | Synthetic data demonstrates the concept. | Inherited: the reference app runs in demo mode and demo-profile benchmarks pass or report explicit skips. No adopter action. |
| M1 | Package adoption — **baseline-done** | Another React app renders shaped atlas data without importing app code. | Inherited and proven by `examples/atlas-consumer`. An adopter confirms it by running the M1 sequence below for a visible render and a passing Tier A gate; the source-invariant validator (`npm run bench:atlas:quick`) reports `renderer-point-elements` and `runtime-test-hook` as pass. |
| M1.5 | Data-shape feasibility | A team can test whether product data makes sense as an atlas before investing in Postgres prep. | About 100 product rows mapped into a local JSON fixture, rendered through `examples/atlas-consumer` or an equivalent host, plus a screenshot or evaluator artifact. |
| M2 | Real-data local adapter | A product maps its own source records into atlas views, points, clusters, density, and entity payloads via the `AtlasStore` interface (D2). | A coordinate recipe that yields in-bounds rows (`examples/atlas-data-prep/coordinate-recipe.mjs` as the template) passing `npm run conformance`; an `AtlasStore` implementation; bounded API/DB responses passing `client-no-db-import`, `lod-thresholds-centralized`, `points-bbox-validation`, `points-no-bulk-metadata`; `EXPLAIN ANALYZE` samples for DB-backed paths. |
| M3 | Product-styled integration | Product teams style data colors and host chrome around the atlas without forking renderer internals. | Data `colorKey` mapping, host `className`/`style` or shell-token examples, the selector registry below, visual audit screenshots or evaluator artifacts; `visual-config-centralized` passes and `render-browser-console-warnings` is pass/warn. |
| M4 | Benchmark-validated integration | Integrations run the right benchmark tier before merging, with CI gating optional. | Tier A portable `@catlas/ui-graph-evaluator` gate for any canvas/SVG host; validator-specific `@catlas/atlas-benchmarks` API/LOD/DB checks for API-only adopters; full quick/standard atlas profiles only for apps with semantic-atlas-compatible shell selectors; Tier B `atlas-clickable-audit` only when the adopter implements semantic-atlas chrome. All source-invariant IDs pass and `payload-density-size`, `payload-clusters-size`, `payload-points-hard-cap` are under budget. Evidence includes repeatable commands, report paths, and a pass/warn/fail/skip policy. |
| M5 | Production readiness | Product owners understand operational work needed before depending on the atlas at scale. | Extends [`docs/atlas-production.md`](atlas-production.md): scale budget, cache/index plan, privacy review, refresh strategy, scale budget review, plus the DB validator finding IDs in the Review Policy. |

The M1 baseline is confirmed with this clean-checkout sequence (every command is a real root script):

```bash
npm run build:packages
npm run example:atlas-consumer:build

# Terminal 1
npm run example:atlas-consumer:preview

# Terminal 2
npm run bench:ui -- \
  --url=http://127.0.0.1:4173 \
  --root-selector='[data-testid="consumer-root"]' \
  --graph-selector='[data-testid="semantic-atlas-map"]' \
  --overlay-selector='[data-atlas-kind="density-label"]' \
  --interaction=wheel-pan \
  --gate
```

## Execution Plan (skills-first)

The minimum skill kit leads. Documentation and examples support what the skills already validate.

### Phase 0: Prerequisites and decisions

- Name the first pilot adopter, owner, stack, and target maturity level.
- Confirm `.cursor/skills/catlas-*/SKILL.md` as the **canonical** skill format (D-aligned: there is no separate playbook doc).
- Pick the first external scale target from the existing 170k / 1M / 10M tiers.
- Decide the documentation policy: adoption docs wrap canonical docs unless a source-of-truth section is explicitly moved.
- Record the contract-stability policy for exported renderer types before adopters depend on them.

**Done when:** an adopter can see, on day one, which `.cursor/skills/catlas-*` skill to run first, which scale tier they are targeting, and which doc is canonical for each surface — with no known broken command/path references.

### Phase 1: Minimum skill kit (leading deliverable)

- Ship `.cursor/skills/catlas-adoption-scout/SKILL.md` and `.cursor/skills/catlas-benchmark-gate/SKILL.md` as the canonical, runnable kit. Each defines YAML frontmatter, preconditions, allowed-edit path globs, prohibited actions, stop conditions, and copy-paste validation commands.
- `catlas-adoption-scout` runs read-only: it inspects an adopter repo and reports framework, data access, graph surface, styling system, and the recommended first maturity target.
- `catlas-benchmark-gate` validates against the **existing** M2 mapping (`examples/atlas-data-prep/coordinate-recipe.mjs` + `npm run conformance`) and runs Tier A `ui-graph-evaluator --gate` first, Tier B clickable audit only for semantic-atlas-compatible chrome.

**Done when:** an adopter can run the scout against their own repo, get a scoped maturity assessment, then run the benchmark-gate skill to produce a Tier A gate result — before reading the full documentation spine.

### Phase 2: Documentation spine

- Add `docs/adoption/` index, quickstart, data contract, Postgres data preparation, styling and theming, benchmark gates, benchmark interpretation, evidence template, and maturity scorecard. The canonical skill format is the SKILL.md files from Phase 1 — there is **no** `agent-playbooks.md`.
- Link the adoption docs from the root README and package READMEs.
- Make adoption docs extend `packages/atlas-react/docs/backend-integration.md` (canonical for types, schema, API shape, adapter pattern, seeding, selectors) instead of duplicating it.
- Add a benchmark-to-maturity map labeling each check by the minimum maturity level it supports.
- Document current default report paths per tool: atlas benchmarks write `outputs/atlas-benchmarks/latest.json` / `latest.md`; clickable audit writes its clickable-audit report under `outputs/atlas-benchmarks/`; the UI evaluator writes `benchmarks/results/ui-evaluator-latest.json`. Reconcile any stale path references.

**Done when:** an adopter can pick the correct doc for package adoption, Postgres prep, styling, benchmarking, or evidence review within 60 s, and no doc claims production readiness without naming the required finding IDs.

### Phase 3: Examples

- Add `examples/atlas-themed-consumer`, `examples/atlas-postgres-adapter`, and `examples/atlas-benchmark-ci` (with a copyable `.github/workflows/atlas-gates.yml` running Tier A by default and documenting Tier B as reference-shell-only).
- `examples/atlas-data-prep` already exists and is the M2 recipe template; keep it the worked path the skills validate.

**Done when:** an adopter can copy an example that matches their stack, run it from a clean checkout, and reproduce a benchmark/evaluator result without importing the Next.js reference app.

### Phase 4: Optional tooling

- Decide whether helper tools (`catlas-adoption-doctor`, `catlas-data-prep-check`, `catlas-evidence-pack`, read-only `catlas-postgres-profile`) live in `@catlas/atlas-benchmarks`, a new package, or example scripts — only after the skills reveal repeated manual checks.

**Done when:** an adopter's tooling output maps directly to the maturity scorecard and every tool failure is actionable and tied to a doc or finding ID.

## Relationship To Existing Docs

Adoption docs wrap and route to canonical docs instead of copying source-of-truth content.

| Area | Canonical source | Adoption-doc rule |
| --- | --- | --- |
| Renderer data types, API shape, Postgres schema, adapter pattern, seeding, benchmark selectors, aggregate refresh/orphan cleanup | `packages/atlas-react/docs/backend-integration.md` | Link here; the data-contract doc is a thin navigation layer plus shape-change notes. |
| Production scale, caching, indexes, observability, risk | `docs/atlas-production.md` | M5 links here and adds adoption-specific evidence; it does not duplicate the production guide. |
| Visual-system and reference-score context | `docs/atlas-visual-system.md` | Styling docs link here for reference-app visual intent. |
| Benchmark commands and report semantics | `docs/atlas-benchmarks.md`, `packages/atlas-benchmarks/README.md`, `packages/ui-graph-evaluator/README.md` | Benchmark-gate docs canonicalize which tool writes which report and which maturity level each result supports. |

## Styling selector registry

The styling guide owns this registry; benchmarks and examples import the same selectors via `ATLAS_SELECTORS`.

| Selector | Owner | Used by |
| --- | --- | --- |
| `[data-testid="semantic-atlas-map"]` | `@catlas/atlas-react` | Portable UI evaluator graph selector. |
| `[data-testid="atlas-canvas"]` | `@catlas/atlas-react` | Renderer/source invariant checks and map-surface evaluation. |
| `[data-testid="atlas-map-canvas"]` | `@catlas/atlas-react` | Render validator and clickable audit map canvas checks. |
| `[data-testid="atlas-overlay"]` | `@catlas/atlas-react` | Overlay persistence and label checks. |
| `[data-atlas-kind="density-label"]` | `@catlas/atlas-react` | Overlay selector for label persistence. |
| `[data-testid="consumer-root"]` | `examples/atlas-consumer` | M1 portable consumer root selector. |
| `[data-testid="atlas-root"]` | `@catlas/semantic-atlas` | Reference-shell root selector. |
| `[data-testid="atlas-search-input"]`, `[data-atlas-kind="lod-button"]`, `[data-atlas-kind="view-button"]`, `[data-atlas-kind="layer-toggle"]`, `[data-testid="atlas-side-panel"]` | `@catlas/semantic-atlas` | Tier B clickable audit only. |

## M5 Production Readiness

M5 evidence **extends** [`docs/atlas-production.md`](atlas-production.md) with adoption-specific expectations and does not duplicate it. Each row links to a real heading in that guide.

| Area | Evidence | Source |
| --- | --- | --- |
| Scale budget | Chosen 170k / 1M / 10M tier with supporting `EXPLAIN ANALYZE` samples. | `atlas-production.md` § Scale Plan |
| Caching | Configured TTLs per LOD band with rationale for refresh cadence. | `atlas-production.md` § Caching Strategy |
| Indexes | All required indexes applied; optional PostGIS decision documented. | `atlas-production.md` § Required Indexes |
| Monitoring | Minimum checklist items instrumented or explicitly deferred with rationale. | `atlas-production.md` § Monitoring Checklist |
| Privacy | Access-control plan or explicit "atlas data is public" statement (D1: control is upstream). | `atlas-production.md` § Known Risks |
| Refresh strategy | Documented cadence for coordinate regeneration, cluster/density rebuild, and cache invalidation; orphan cleanup per `backend-integration.md` § Aggregate refresh & orphan cleanup. | `atlas-production.md` § Real-Data Integration Still Needed |
| Operational commands | All commands in `atlas-production.md` § Operational Commands verified against the adopter environment. | `atlas-production.md` § Operational Commands |

M5 is the final maturity level. It does not require every production concern to be resolved — only that product owners reviewed each area, recorded decisions, and identified residual risks with owners and timelines.

## Evidence Template

Every adoption PR should include:

- [ ] **[M0+]** Product/app route and local URL used for validation.
- [ ] **[M0+]** Package and app commands run.
- [ ] **[M0+]** Benchmark tier, commands run, and report paths.
- [ ] **[M0+]** Known skips, warnings, and residual risks.
- [ ] **[M0+]** `npm audit` (or `npm audit --omit=dev`) status attached as packaging/security evidence.
- [ ] **[M0+]** Explicit claim scope: demo baseline, package adoption, data-shape feasibility, real-data local adapter, product-styled integration, benchmark-validated integration, or production readiness.
- [ ] **[M2+]** `DATABASE_URL` status: configured against local/staging, skipped, or intentionally absent. Never point adoption benchmarks at active production.
- [ ] **[M2+]** Query-plan evidence for real-data paths, including representative `EXPLAIN ANALYZE` samples.
- [ ] **[M3+]** Screenshots or evaluator artifacts for styling changes.

## Review Policy

Adoption claims are reviewed against benchmark finding IDs, not abstract principles. The Promise / Ability / Performance (P/A/P) framework binds to concrete validator output:

- **Promise** — the maturity level claimed in docs or PR (the row in the Maturity Model).
- **Ability** — validator findings with `status: "pass"` or `status: "skip"`: code exists and runs but may not yet produce measured evidence. For M1 this is `renderer-point-elements` and `runtime-test-hook`; for M2 it is the source-invariant subset `client-no-db-import`, `lod-thresholds-centralized`, `points-bbox-validation`, `points-no-bulk-metadata`.
- **Performance** — findings with measured values under budget: `payload-density-size`, `payload-clusters-size`, `payload-points-hard-cap` from `createReportFindings()` (`hardFailures`, `sotaMisses`, `warnings`, `skipped`). For M5, the DB latency finding IDs below.

| Maturity | Required finding IDs (pass or acceptable warn; not skip) |
| --- | --- |
| M1 | `renderer-point-elements`, `runtime-test-hook` |
| M2 | `client-no-db-import`, `lod-thresholds-centralized`, `points-bbox-validation`, `points-no-bulk-metadata` (minimum subset; full source-invariant list required at M4) |
| M3 | `visual-config-centralized`, `render-browser-console-warnings` (warn acceptable) |
| M4 | All source-invariant IDs pass; `payload-density-size`, `payload-clusters-size`, `payload-points-hard-cap` under budget |
| M5 | M4 + DB validator emits pass (not skip) for `db-views-list-latency`, `db-density-bbox-latency`, `db-clusters-bbox-latency`, `db-points-bbox-latency`, `db-entity-lookup-latency`, `db-search-latency` plus per-scenario row-bound and index-plan checks |

Reject claims that skip from ability to promise without measured evidence.

Overclaim example: a PR says "M4 benchmark-validated integration complete" but only ran `bench:atlas:quick` without `--gate` and attached no report. The ability exists because benchmarks are configured, but no measured performance evidence supports the M4 promise — specifically, finding IDs `payload-density-size`, `payload-clusters-size`, `payload-points-hard-cap` were never emitted with `status: "pass"`.

## Success Criteria

- M1 time-to-first-render: a clean React adopter reaches a visible atlas render and Tier A UI evaluator report in 1800 s or less after dependencies install.
- M1.5 feasibility: a pilot maps about 100 product rows into a local fixture and decides whether the atlas shape is plausible before starting database work.
- M2 data prep: a pilot produces bounded API responses and representative query-plan evidence without using active production data, and `npm run conformance` passes for their recipe.
- M4 education: benchmark reports drive at least one concrete fix or documented accepted warning, not just a pass/fail badge.
- Adoption scale: a second adopter reaches M1 or M1.5 without direct maintainer hand-holding once the minimum skill kit exists.

## Open Questions

- Which product, owner, and stack should be the first pilot adopter after the reference app?
- What target maturity level should that pilot claim first?
- Should helper tools (e.g. `catlas-adoption-doctor`) live in `@catlas/atlas-benchmarks` or a separate package?
- What is the first external data size target beyond the current local benchmark scale?
- Which exported type fields need an immediate contract-stability changelog before broader adopter work begins?
- Who approves promotion between maturity levels: self-assessment, peer review, or a future evidence-reviewer skill?
