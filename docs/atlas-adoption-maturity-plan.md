# Atlas Adoption Maturity Plan

## Objective

Make Catlas adoptable by other products that need to render real semantic-map data, validate their graph UI with benchmark tooling, and produce evidence that the integration is bounded, styled correctly, and ready for production hardening.

This is an execution plan, not a claim that all adoption surfaces already exist. The current repository proves the core ability through:

- `@catlas/atlas-react`: reusable React renderer that accepts shaped atlas data.
- `@catlas/ui-graph-evaluator`: portable graph UI evaluator for any canvas or SVG host.
- `@catlas/atlas-benchmarks`: atlas-specific API, LOD, render, and clickable audit gates.
- `@catlas/semantic-atlas`: Next.js + Postgres reference integration.
- `examples/atlas-consumer`: minimal Vite consumer that imports only the renderer.

The next maturity step is to turn that ability into an adopter path with real-data preparation, styling guidance, benchmark gates, and agent-assisted examples.

## Scope

In scope:

- Required documentation examples for product teams adopting the renderer.
- Real-data Postgres preparation steps before data reaches `SemanticAtlasMap`.
- Styling and theming guidance that keeps product styling outside renderer internals.
- Benchmark and evidence gates that separate promise, ability, and measured performance.
- Agent-assisted playbooks that developers can run while adapting their own product data.

Out of scope for this plan:

- Replacing the current renderer.
- Changing the reference schema as part of this adoption work.
- Importing any production customer data into this repository.
- Hosting CI infrastructure or publishing packages.

In scope for this plan:

- A sample CI workflow YAML that adopters can copy into their own repository.

## Maturity Model

| Level | Name | Promise | Required evidence |
| --- | --- | --- | --- |
| M0 | Demo baseline | Synthetic data demonstrates the concept. | Local app runs, demo-mode benchmarks pass or report explicit skips. |
| M1 | Package adoption | Another React app can render shaped atlas data without importing app code. | Build packages, run the consumer fixture, then pass the Tier A UI evaluator gate. The exact clean-checkout command sequence belongs in `docs/adoption/quickstart.md`. |
| M1.5 | Data-shape feasibility | A team can test whether product data makes sense as an atlas before investing in Postgres prep. | About 100 product rows mapped into a local JSON fixture, rendered through the consumer example or equivalent host, plus a screenshot or evaluator artifact. |
| M2 | Real-data local adapter | A product can map its own source records into atlas views, points, clusters, density, and entity payloads. | Data-prep runbook, schema mapping, local seed or read-only staging data, `EXPLAIN ANALYZE` samples for database-backed paths, bounded API responses. |
| M3 | Product-styled integration | Product teams can style data colors and host chrome around the atlas without forking renderer internals. | Data `colorKey` mapping, host `className`/`style` or shell-token examples, selector registry, visual audit screenshots or evaluator artifacts. |
| M4 | Benchmark-validated integration | Integrations can run the right benchmark tier before merging, with CI gating optional. | Tier A portable `@catlas/ui-graph-evaluator` gate for any canvas/SVG host; validator-specific `@catlas/atlas-benchmarks` API/LOD/DB checks for API-only adopters; full quick or standard atlas profiles only for apps with semantic-atlas-compatible shell selectors and source-layout assumptions; Tier B `atlas-clickable-audit` only when the adopter implements semantic-atlas chrome. Evidence includes repeatable commands, report paths, pass/warn/fail/skip policy, sample CI workflow, and benchmark interpretation guidance. |
| M5 | Production readiness | Product owners understand operational work needed before depending on the atlas at scale. | `docs/atlas-production.md` checklist, cache/index plan, privacy review, refresh strategy, scale budget review. |

The M1 quickstart must include this clean-checkout command sequence:

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

## Contract Stability

The public exports from `@catlas/atlas-react` plus the data-shape exports from `@catlas/atlas-react/types` are the adoption contract. Root exports include the component, component props, viewport state, layer toggles, and helpers such as `bboxForViewport`; the `/types` subpath covers atlas data shapes such as `AtlasPoint`, `AtlasCluster`, `AtlasDensityTile`, and `AtlasView`. Adoption docs must show the correct import path for each symbol.

Breaking changes to exported adoption types, component props, viewport behavior, and data shapes require an explicit breaking-change note and, after package publication policy is defined, a major version bump. Additive optional fields are non-breaking when existing adopters can ignore them safely.

The reference app routes under `/api/atlas/*` are illustrative, not contractual. Adopters own their API layer as long as they provide the shaped renderer data and preserve boundedness, LOD, and metadata-loading constraints.

## Relationship To Existing Docs

Adoption docs should wrap and route to canonical docs instead of copying their source-of-truth content.

| Area | Canonical source | Adoption-doc rule |
| --- | --- | --- |
| Renderer data types, API shape, Postgres schema, adapter pattern, seeding, and benchmark selectors | `packages/atlas-react/docs/backend-integration.md` | `docs/adoption/data-contract.md` should be a thin navigation layer plus shape-change notes, unless the canonical type section is formally extracted there and referenced back. |
| Production scale, caching, indexes, observability, and risk | `docs/atlas-production.md` | M5 should link here and add adoption-specific evidence expectations, not duplicate the production guide. |
| Visual-system and reference-score context | `docs/atlas-visual-system.md` | Styling docs should link here for reference-app visual intent and explain adopter-specific baselines. |
| Benchmark commands and report semantics | `docs/atlas-benchmarks.md`, `packages/atlas-benchmarks/README.md`, `packages/ui-graph-evaluator/README.md` | Benchmark-gate docs should canonicalize which tool writes which report path and which maturity level each result supports. |

## Required Documentation Set

Create the following adopter-facing docs. Each doc should include copyable commands, expected artifacts, and a short "done when" section.

| Artifact | Purpose | Proposed path |
| --- | --- | --- |
| Canonical backend integration (existing) | Source of truth for renderer types, Postgres schema, API shape, adapter pattern, seeding, and benchmark selectors. Adoption docs should link to this rather than duplicate it. | `packages/atlas-react/docs/backend-integration.md` |
| Production readiness guide (existing) | Source of truth for scale, caching, indexes, observability, and production risk. M5 adoption docs should link to this rather than duplicate it. | `docs/atlas-production.md` |
| Adoption index | Single navigation entry point with decision tree, M0-M5 checklist, and "read only when needed" routing. | `docs/adoption/index.md` |
| Adoption quickstart | First successful renderer integration in another React app. | `docs/adoption/quickstart.md` |
| Data contract | Thin pointer to the canonical backend integration doc plus shape-change and versioning notes. | `docs/adoption/data-contract.md` |
| Postgres data preparation | Step-by-step path from existing product tables to atlas tables and bounded endpoints. | `docs/adoption/postgres-data-prep.md` |
| Styling and theming | How products apply data colors, host-shell tokens, container sizing, and benchmark selectors without editing renderer internals. | `docs/adoption/styling-and-theming.md` |
| Benchmark gates | How to run Tier A portable UI evaluator, Tier B reference-shell audits, atlas benchmarks, live DB checks, and sample CI. | `docs/adoption/benchmark-gates.md` |
| Benchmark interpretation | How to read PASS, WARN, FAIL, SKIP, recommended next actions, reference scores, and when `--gate` is appropriate. | `docs/adoption/benchmark-interpretation.md` |
| Evidence template | What to attach to PRs before claiming adoption maturity. | `docs/adoption/evidence-template.md` |
| Agent playbooks | Guided `.cursor/skills/catlas-*` skill specs and human checklists for developers using agentic coding tools. | `docs/adoption/agent-playbooks.md` |
| Maturity scorecard | M0-M5 status sheet, including the optional M1.5 feasibility checkpoint, for each adopter product. | `docs/adoption/maturity-scorecard.md` |

## Required Example Set

The examples should be small enough to audit, but realistic enough that teams can adapt them.

| Example | Shows | Proposed path |
| --- | --- | --- |
| Themed renderer consumer | Product-owned styling, layout, color groups, and selector contract around `@catlas/atlas-react`. | `examples/atlas-themed-consumer` |
| Postgres adapter fixture | Mapping from generic product tables into atlas views, points, clusters, density, and entity endpoints. | `examples/atlas-postgres-adapter` |
| Benchmark CI fixture | Local and CI commands for `ui-graph-evaluator`, `atlas-benchmark`, and clickable audit. | `examples/atlas-benchmark-ci` |
| Real-data preparation notebook or script | Deterministic transform from source rows to atlas import rows with validation summaries. | `examples/atlas-data-prep` |

Each example should include:

- `README.md` with setup, run, benchmark, and cleanup commands.
- `.env.example` when environment variables are required.
- A tiny seed dataset that is safe to commit.
- A "replace this with your product data" section.
- Expected benchmark report paths.
- For `examples/atlas-benchmark-ci`, a skeleton `.github/workflows/atlas-gates.yml` that runs Tier A by default and documents Tier B as reference-shell-only.

## Postgres Data Preparation Flow

Product teams with an existing Postgres database should follow this route before rendering or benchmarking. Postgres is the reference path, not a hard dependency: adopters with MySQL, MongoDB, APIs, files, or other stores should shape rows into the same exported TypeScript types and skip database-specific steps that do not apply. The portable benchmark gates are database-agnostic.

1. **Inventory source tables.** Identify source entity tables, relationship tables, timestamps, permissions, and metadata fields. Record row counts and update cadence.
2. **Choose atlas views.** Define one or more projections such as product ontology, people, topics, documents, or incidents. Each view needs a stable slug, title, and coordinate method.
3. **Generate coordinates.** Produce deterministic `x` and `y` coordinates per entity per view. The coordinate method can be embedding projection, graph layout, manual taxonomy placement, or another product-owned transform.
4. **Shape lightweight point rows.** Keep point payloads small: ids, labels, coordinates, importance, color/group fields, and small search hints. Keep heavy metadata behind entity lookup.
5. **Precompute clusters and density.** Low and medium zoom must use aggregate tables. Do not rely on raw point scans for low-zoom navigation.
6. **Apply indexes.** Keep bbox, entity, cluster, density, and search indexes in place. Optional PostGIS can improve spatial work, but the numeric bbox path remains the baseline.
7. **Implement bounded endpoints.** Use `ATLAS_LOD_CONFIG` from `@catlas/atlas-react/lod` as the source for zoom thresholds and caps, but keep route mapping product-owned. The reference helper `getLodForZoom` returns `/api/atlas/*` endpoint strings for the example app; non-reference adopters should map density, cluster, and point layers to their own routes. Preserve the same thresholds: density below zoom 3, clusters from zoom 3 through 6, and points at zoom 6.01 and above. Enforce bbox validation, LOD checks, row caps, lightweight payloads, and stable error shapes.
8. **Run query evidence.** Capture representative `EXPLAIN ANALYZE` for views, density, clusters, high-zoom points, entity lookup, and search.
9. **Run local DB validation.** Configure `DATABASE_URL` against a local seed database, disposable container, or read-only staging replica, never active production. Run the live DB validator and capture query-plan evidence. UI and clickable audits are M4 evidence; at M2 they are optional smoke checks only.
10. **Record residual risks.** Note skipped checks, production-only concerns, auth gaps, privacy constraints, and scale assumptions.

## Styling and Theming Flow

Styling should remain product-owned. M3 is scoped to product data colors, host chrome, container behavior, and benchmark evidence. The current renderer supports `colorKey`-driven data colors plus host `className` and `style`; map paper, label rendering, and selection chrome are centralized in `visualConfig.ts` and are not general theme APIs yet. Adopters should not fork renderer internals for brand styling.

OntoTwin Atlas tokens and kit CSS are the reference-app shell, not a required adopter dependency. Link `docs/atlas-visual-system.md` for the reference visual target and keep product tokens in the host app unless a reusable theme API is added later.

`ATLAS_VISUAL_CONFIG`, exported from `@catlas/atlas-react/visualConfig`, is the current renderer styling boundary. Product colors flow through `colorKey` fields on points, clusters, and density payloads. The renderer palette, paper, ink, halos, selection, hover, label counts, collision behavior, point sizing, and cluster sizing currently live in `ATLAS_VISUAL_CONFIG`; changing those without forking requires a future config override API. The M3 styling guide should make that boundary explicit.

Recommended guidance:

- Set explicit parent dimensions. The renderer needs a stable container height and width.
- Map product categories to point and cluster color fields before passing data to the component.
- Require `colorKey` on every `AtlasCluster`; set `AtlasPoint.colorKey` only when a point needs to override cluster or fallback coloring.
- Keep density, point, cluster, label, and selected states visually distinct.
- Use product design tokens in the host shell and pass renderer data colors through shaped records.
- Keep search, inspector, side panels, and navigation chrome outside `@catlas/atlas-react` unless they are promoted into a reusable package later.
- Document stable selectors used by benchmarks, including root, canvas, overlay labels, and product-specific panels.
- Use `@catlas/ui-graph-evaluator` artifacts to compare before/after styling changes.

The styling doc should include a selector registry:

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

## Agent-Assisted Adoption Playbooks

Agentic assistance should produce repeatable work, not unreviewed transformations. Repo-local agent skills should live under `.cursor/skills/catlas-*/SKILL.md`; human-readable summaries can be linked from `docs/adoption/agent-playbooks.md`.

| Playbook | Mode | Role | Inputs | Outputs |
| --- | --- | --- | --- | --- |
| `catlas-adoption-scout` | Agent-first | Explore an adopter repo and identify app framework, database access, graph surface, and styling system. | Repo path, package manager, target app route. | Adoption assessment and recommended next file edits. |
| `catlas-benchmark-gate` | Agent-first | Add repeatable local and CI benchmark commands. | Local app URL, selectors, expected gates. | Commands, report paths, pass/warn/fail policy. |
| `catlas-postgres-prep` | Hybrid | Map source Postgres tables into atlas import shapes. | Schema dump, sample rows, target views. | Mapping plan, transform script outline, index checklist. |
| `catlas-styling-adapter` | Hybrid | Align atlas data colors and host chrome with product design tokens. | Token docs, screenshots, component paths. | Styling plan and benchmark selectors. |
| `catlas-evidence-reviewer` | Human-first | Review an adoption PR for maturity claims. | PR diff, benchmark reports, screenshots. | Accepted findings, rejected findings, residual risks. |

Each skill must define YAML frontmatter, preconditions, path globs for allowed edits, prohibited actions, stop conditions, and copy-paste validation commands. Common prohibited actions: never commit `.env`, generated production data, database dumps, or credentials; never run destructive SQL such as `DROP TABLE`; never claim M2 or higher without source-data evidence.

Worked example for `catlas-benchmark-gate`:

```text
Preconditions: app route is known, package manager is known, and a canvas/SVG graph surface exists.
Stop condition: stop after 3 route scans if no graph selector can be found.
Allowed edits: package scripts, docs, CI example files, and benchmark selector config.
Validation: run Tier A `ui-graph-evaluator` first; run Tier B clickable audit only for semantic-atlas-compatible shell chrome.
Output: commands, report paths, pass/warn/fail interpretation, and maturity level supported by evidence.
```

Worked example for `catlas-adoption-scout`:

```text
Preconditions: repo path is known and dependencies can be inspected read-only.
Stop condition: stop if no React app, graph surface, or route candidate is found after 3 route scans.
Allowed edits: none during scout mode.
Validation: report package manager, app routes, likely graph selectors, styling system, data source, and recommended first maturity target.
Output: adoption-readiness summary plus next skill to run.
```

## Proposed Tools

Current tools to document as adopter-facing:

- `@catlas/atlas-react`: renderer package and types.
- `@catlas/ui-graph-evaluator`: portable graph UI benchmark.
- `@catlas/atlas-benchmarks`: atlas API, render, LOD, and clickable gates.
- Reference migrations under `apps/semantic-atlas/migrations`.
- `packages/atlas-benchmarks/src/sql/explain-atlas-queries.sql` for query-plan review.
- Docker Compose Postgres setup for disposable local validation.

New tools to consider after docs are in place:

- `catlas-adoption-doctor`: verifies selectors, package boundaries, app URL health, and benchmark readiness.
- `catlas-postgres-profile`: summarizes source row counts, candidate keys, null rates, and index coverage from a read-only database connection.
- `catlas-data-prep-check`: validates transformed rows before seed/import, including coordinate bounds and missing labels.
- `catlas-evidence-pack`: collects benchmark JSON/Markdown, screenshots, query plans, and environment summaries into one PR attachment folder.

## Execution Plan

### Phase 0: Prerequisites and decisions

- Name the first pilot adopter, owner, stack, and target maturity level.
- Set `.cursor/skills/catlas-*` as the canonical skill format for repo-local agent playbooks.
- Pick the first external scale target from the existing 170k, 1M, and 10M tiers.
- Decide the documentation policy: adoption docs wrap canonical docs unless a source-of-truth section is explicitly moved.
- Record the contract-stability policy for exported renderer types before asking adopters to depend on them.
- Restore or remove ghost `validate:atlas` references.
- Fix `atlas-analyze-queries.ts` SQL path drift.
- Canonicalize report paths per tool.
- Add the `docs/adoption/index.md` decision tree skeleton before expanding the rest of the adoption-doc spine.

Done when:

- Phase 1 has a named pilot adopter, a canonical `.cursor/skills/` format, a selected 170k/1M/10M scale target, a doc wrap-versus-supersede policy, an exported-type contract policy, and no known broken command/path references.

### Phase 0.5: Minimum viable adoption kit

- Add `docs/adoption/index.md` as the primary adoption entry point with a decision tree, M0-M5 checklist including M1.5, and "read only when needed" section.
- Ship `.cursor/skills/catlas-adoption-scout/SKILL.md` and `.cursor/skills/catlas-benchmark-gate/SKILL.md`.
- Stub Adoption quickstart with the M1 command sequence before the full Phase 1 docs expand.
- Keep the minimum reader path to the index, quickstart stub, `examples/atlas-consumer`, and the Tier A `ui-graph-evaluator --gate` command.
- Include a migration path for informal adopters: run `npx ui-graph-evaluator --gate` or the workspace `bench:ui` equivalent against the current app to establish a baseline, then use the maturity scorecard to identify gaps.
- Include rollback guidance: if M2 fails, treat it as a data-shape or bounded-endpoint issue, fall back to M1/M1.5 evidence, and revisit source-schema mapping before changing renderer internals.

Done when:

- A product team can evaluate Catlas with minimal reading before committing to the full documentation spine.

### Phase 1: Documentation spine

- Add `docs/adoption/` index, Adoption quickstart, Data contract, Postgres data preparation, Styling and theming, Benchmark gates, Benchmark interpretation, Evidence template, Agent playbooks, and Maturity scorecard.
- Link the adoption docs from the root README and package READMEs.
- Reconcile existing query-plan path references against `packages/atlas-benchmarks/src/sql/explain-atlas-queries.sql`.
- Add a canonical backend-doc map so adoption docs extend `packages/atlas-react/docs/backend-integration.md` and do not duplicate it.
- Add a benchmark-to-maturity map: M1 graph-present checks, M1.5 fixture-render checks, M2 bounded API/DB checks, M3 visual artifacts, and M4 full gate pass. Reports should group or label checks by the minimum maturity level they support.
- Document current default report paths per tool: atlas benchmarks write `outputs/atlas-benchmarks/latest.json` and `outputs/atlas-benchmarks/latest.md`; clickable audit writes `outputs/atlas-benchmarks/clickable-audit-latest.json` and optional artifacts under `outputs/atlas-benchmarks/clickable-audit-artifacts`; UI evaluator writes `benchmarks/results/ui-evaluator-latest.json` and optional artifacts under `benchmarks/results/ui-evaluator-artifacts`. Reconcile stale docs that still mention older `benchmarks/results/latest.*` or `outputs/ui-evaluator/` paths unless the runner defaults are intentionally changed.
- Document reference-score interpretation: scores above 70 indicate strong visual-texture fidelity, 50-70 is acceptable for early integration, and below 50 means adopters should review density data, canvas rendering, or their chosen baseline before setting `--min-reference-score`.
- Define the minimum adopter evidence required for M1, M1.5, M2, M3, and M4.
- Move runbook-heavy prose into child docs as Phase 1 lands; keep this plan as the routing artifact and target roughly 150 lines after extraction.

Done when:

- A developer can choose the correct doc for package adoption, Postgres prep, styling, benchmarking, or evidence review within 60 s.
- No doc claims production readiness without naming the evidence required.

### Phase 2: Examples

- Add `examples/atlas-themed-consumer`.
- Add `examples/atlas-postgres-adapter` with a tiny committed dataset and local Postgres setup.
- Add `examples/atlas-benchmark-ci` with local and CI command examples.
- Add `examples/atlas-benchmark-ci/.github/workflows/atlas-gates.yml` as a copyable skeleton that runs Tier A by default and documents Tier B requirements.
- Add `examples/atlas-data-prep` with a deterministic transform script and validation summary.

Done when:

- Each example builds or runs from a clean checkout.
- Each example has an evaluator or benchmark command.
- The examples do not import from the Next.js reference app unless explicitly testing reference behavior.

### Phase 3: Agent playbook expansion

- Expand the Phase 0.5 skills into the full `.cursor/skills/catlas-*` set.
- Include required inputs, allowed edits, stop conditions, and validation commands.
- Add an evidence-reviewer checklist that catches overclaims.

Done when:

- An agent can inspect an adopter repo, propose a scoped adoption plan, and identify missing evidence before editing code.
- The playbooks keep database credentials, source data, generated artifacts, and production claims out of git.

### Phase 4: Tooling

- Decide whether the proposed tools should live in `@catlas/atlas-benchmarks`, a new package, or scripts under examples.
- Start with `catlas-adoption-doctor` only if the docs reveal repeated manual checks.
- Add `catlas-data-prep-check` when multiple adopters need repeatable transform validation before import.
- Add `catlas-evidence-pack` when PR reviews repeatedly need bundled benchmark reports, screenshots, query plans, and environment summaries.
- Keep database profiling through `catlas-postgres-profile` read-only unless a user explicitly opts into generated migrations or transforms.

Done when:

- Tool output maps directly to the maturity scorecard.
- Tool failures are actionable and tied to docs.

## Evidence Template

Every adoption PR should include:

- [ ] **[M0+]** Product/app route and local URL used for validation.
- [ ] **[M0+]** Package and app commands run.
- [ ] **[M0+]** Benchmark tier, commands run, and report paths.
- [ ] **[M0+]** Known skips, warnings, and residual risks.
- [ ] **[M0+]** Explicit claim scope: demo baseline, local package adoption, data-shape feasibility, real-data local adapter, product-styled integration, benchmark-validated integration, or production readiness.
- [ ] **[M2+]** `DATABASE_URL` status: configured against local/staging, skipped, or intentionally absent. Never point adoption benchmarks at active production.
- [ ] **[M2+]** Query-plan evidence for real-data paths, including representative `EXPLAIN ANALYZE` samples.
- [ ] **[M3+]** Screenshots or evaluator artifacts for styling changes.

## Review Policy

Adoption claims should be reviewed using the First Principles Framework claim-validation distinctions:

- **Promise:** What the docs or PR says other products can rely on.
- **Ability:** What the code and examples are capable of today.
- **Performance:** What benchmark reports, query plans, screenshots, and runtime checks prove.

Reject claims that skip from ability to promise without measured evidence.

Overclaim example: a PR says "M4 benchmark-validated integration complete" but only ran `bench:atlas:quick` without `--gate` and attached no report. The ability exists because benchmarks are configured, but no measured performance evidence supports the M4 promise.

## Success Criteria

- M1 time-to-first-render: a clean React adopter can reach a visible atlas render and Tier A UI evaluator report in 1800 s or less after dependencies install.
- M1.5 feasibility: a pilot can map about 100 product rows into a local fixture and decide whether the atlas shape is plausible before starting database work.
- M2 data prep: a pilot can produce bounded API responses and representative query-plan evidence without using active production data.
- M4 education: benchmark reports drive at least one concrete fix or documented accepted warning, not just a pass/fail badge.
- Adoption scale: a second adopter reaches M1 or M1.5 without direct maintainer hand-holding after the Phase 0.5 kit exists.

## Open Questions

- Which product, owner, and stack should be the first pilot adopter after the reference app?
- What target maturity level should that pilot claim first: M1, M1.5, M2, M3, M4, or M5?
- Should `catlas-adoption-doctor` be part of `@catlas/atlas-benchmarks` or a separate package?
- What is the first external data size target beyond the current local benchmark scale?
- Which exported type fields need an immediate contract-stability changelog before broader adopter work begins?
- What should an adopter do when source data cannot be mapped into stable `x`/`y` coordinates or aggregate clusters?
- Who approves promotion between maturity levels: self-assessment, peer review, or the future `catlas-evidence-reviewer` playbook?
