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
- Changing the reference schema in this PR.
- Importing any production customer data into this repository.
- Adding a CI service or publishing packages.

## Maturity Model

| Level | Name | Promise | Required evidence |
| --- | --- | --- | --- |
| M0 | Demo baseline | Synthetic data demonstrates the concept. | Local app runs, demo-mode benchmarks pass or report explicit skips. |
| M1 | Package adoption | Another React app can render shaped atlas data without importing app code. | `examples/atlas-consumer` builds and passes `@catlas/ui-graph-evaluator`. |
| M2 | Real-data local adapter | A product can map its own Postgres records into atlas views, points, clusters, density, and entity payloads. | Data-prep runbook, schema mapping, seeded local database, `EXPLAIN ANALYZE` samples, bounded API responses. |
| M3 | Product-styled integration | Product teams can style the atlas surface without forking renderer internals. | Styling guide, token/color examples, selector contract, visual audit screenshots or evaluator artifacts. |
| M4 | Benchmark-gated adoption | Integrations can run portable UI and atlas-specific gates before merging. | Repeatable commands, report paths, documented pass/warn/fail/skip policy, sample CI workflow. |
| M5 | Production readiness | Product owners understand operational work needed before depending on the atlas at scale. | Observability checklist, cache/index plan, privacy review, refresh strategy, scale budget review. |

## Required Documentation Set

Create the following adopter-facing docs. Each doc should include copyable commands, expected artifacts, and a short "done when" section.

| Artifact | Purpose | Proposed path |
| --- | --- | --- |
| Adoption quickstart | First successful renderer integration in another React app. | `docs/adoption/quickstart.md` |
| Data contract | Shapes for views, points, clusters, density, entity metadata, and search. | `docs/adoption/data-contract.md` |
| Postgres data preparation | Step-by-step path from existing product tables to atlas tables and bounded endpoints. | `docs/adoption/postgres-data-prep.md` |
| Styling and theming | How products apply design tokens, colors, labels, container sizing, and overlays without editing renderer internals. | `docs/adoption/styling-and-theming.md` |
| Benchmark gates | How to run UI evaluator, atlas benchmarks, clickable audit, and live DB checks. | `docs/adoption/benchmark-gates.md` |
| Evidence template | What to attach to PRs before claiming adoption maturity. | `docs/adoption/evidence-template.md` |
| Agent playbooks | Guided prompts/checklists for developers using agentic coding tools. | `docs/adoption/agent-playbooks.md` |
| Maturity scorecard | M0-M5 status sheet for each adopter product. | `docs/adoption/maturity-scorecard.md` |

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

## Postgres Data Preparation Flow

Product teams with an existing Postgres database should follow this route before rendering or benchmarking:

1. **Inventory source tables.** Identify source entity tables, relationship tables, timestamps, permissions, and metadata fields. Record row counts and update cadence.
2. **Choose atlas views.** Define one or more projections such as product ontology, people, topics, documents, or incidents. Each view needs a stable slug, title, and coordinate method.
3. **Generate coordinates.** Produce deterministic `x` and `y` coordinates per entity per view. The coordinate method can be embedding projection, graph layout, manual taxonomy placement, or another product-owned transform.
4. **Shape lightweight point rows.** Keep point payloads small: ids, labels, coordinates, importance, color/group fields, and small search hints. Keep heavy metadata behind entity lookup.
5. **Precompute clusters and density.** Low and medium zoom must use aggregate tables. Do not rely on raw point scans for low-zoom navigation.
6. **Apply indexes.** Keep bbox, entity, cluster, density, and search indexes in place. Optional PostGIS can improve spatial work, but the numeric bbox path remains the baseline.
7. **Implement bounded endpoints.** Mirror the reference route behavior: bbox validation, LOD checks, row caps, lightweight payloads, and stable error shapes.
8. **Run query evidence.** Capture representative `EXPLAIN ANALYZE` for views, density, clusters, high-zoom points, entity lookup, and search.
9. **Run benchmark gates.** Configure `DATABASE_URL`, run the live DB validator, then run UI and clickable audits against the adopter app.
10. **Record residual risks.** Note skipped checks, production-only concerns, auth gaps, privacy constraints, and scale assumptions.

## Styling and Theming Flow

Styling should remain product-owned. The renderer should expose stable data shapes, selectors, callbacks, and container behavior; adopters should not fork renderer internals for brand styling.

Recommended guidance:

- Set explicit parent dimensions. The renderer needs a stable container height and width.
- Map product categories to point and cluster color fields before passing data to the component.
- Keep density, point, cluster, label, and selected states visually distinct.
- Use product design tokens in the host shell and pass renderer data colors through shaped records.
- Keep search, inspector, side panels, and navigation chrome outside `@catlas/atlas-react` unless they are promoted into a reusable package later.
- Document stable selectors used by benchmarks, including root, canvas, overlay labels, and product-specific panels.
- Use `@catlas/ui-graph-evaluator` artifacts to compare before/after styling changes.

## Agent-Assisted Adoption Playbooks

Agentic assistance should produce repeatable work, not unreviewed transformations. Proposed repo-local playbooks:

| Playbook | Role | Inputs | Outputs |
| --- | --- | --- | --- |
| `catlas-adoption-scout` | Explore an adopter repo and identify app framework, database access, graph surface, and styling system. | Repo path, package manager, target app route. | Adoption assessment and recommended next file edits. |
| `catlas-postgres-prep` | Map source Postgres tables into atlas import shapes. | Schema dump, sample rows, target views. | Mapping plan, transform script outline, index checklist. |
| `catlas-styling-adapter` | Align atlas data colors and host chrome with product design tokens. | Token docs, screenshots, component paths. | Styling plan and benchmark selectors. |
| `catlas-benchmark-gate` | Add repeatable local and CI benchmark commands. | Local app URL, selectors, expected gates. | Commands, report paths, pass/warn/fail policy. |
| `catlas-evidence-reviewer` | Review an adoption PR for maturity claims. | PR diff, benchmark reports, screenshots. | Accepted findings, rejected findings, residual risks. |

These can become Claude Code or Codex skills later. Until then, `docs/adoption/agent-playbooks.md` should provide copyable prompts and checklists.

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

### Phase 1: Documentation spine

- Add `docs/adoption/` index, quickstart, data contract, Postgres prep, styling guide, benchmark gates, evidence template, agent playbooks, and maturity scorecard.
- Link the adoption docs from the root README and package READMEs.
- Reconcile existing query-plan path references against `packages/atlas-benchmarks/src/sql/explain-atlas-queries.sql`.
- Define the minimum adopter evidence required for M1, M2, M3, and M4.

Done when:

- A developer can choose the correct doc for package adoption, Postgres prep, styling, benchmarking, or evidence review within 60 s.
- No doc claims production readiness without naming the evidence required.

### Phase 2: Examples

- Add `examples/atlas-themed-consumer`.
- Add `examples/atlas-postgres-adapter` with a tiny committed dataset and local Postgres setup.
- Add `examples/atlas-benchmark-ci` with local and CI command examples.
- Add `examples/atlas-data-prep` with a deterministic transform script and validation summary.

Done when:

- Each example builds or runs from a clean checkout.
- Each example has an evaluator or benchmark command.
- The examples do not import from the Next.js reference app unless explicitly testing reference behavior.

### Phase 3: Agent playbooks

- Convert the playbooks into repo-local skill docs or equivalent prompt files.
- Include required inputs, allowed edits, stop conditions, and validation commands.
- Add an evidence-reviewer checklist that catches overclaims.

Done when:

- An agent can inspect an adopter repo, propose a scoped adoption plan, and identify missing evidence before editing code.
- The playbooks keep database credentials, source data, generated artifacts, and production claims out of git.

### Phase 4: Tooling

- Decide whether the proposed tools should live in `@catlas/atlas-benchmarks`, a new package, or scripts under examples.
- Start with `catlas-adoption-doctor` only if the docs reveal repeated manual checks.
- Keep database profiling read-only unless a user explicitly opts into generated migrations or transforms.

Done when:

- Tool output maps directly to the maturity scorecard.
- Tool failures are actionable and tied to docs.

## Evidence Template

Every adoption PR should include:

- Product/app route and local URL used for validation.
- Package and app commands run.
- Benchmark commands run and report paths.
- `DATABASE_URL` status: configured, skipped, or intentionally absent.
- Query-plan evidence for real-data paths, when M2 or higher is claimed.
- Screenshots or evaluator artifacts for styling changes, when M3 or higher is claimed.
- Known skips, warnings, and residual risks.
- Explicit claim scope: demo, local package adoption, real-data local adapter, benchmark-gated adoption, or production readiness.

## Review Policy

Adoption claims should be reviewed using the FPF distinctions:

- **Promise:** What the docs or PR says other products can rely on.
- **Ability:** What the code and examples are capable of today.
- **Performance:** What benchmark reports, query plans, screenshots, and runtime checks prove.

Reject claims that skip from ability to promise without measured evidence.

## Open Questions

- Which product should be the first real adopter after the reference app?
- Should repo-local agent playbooks be implemented as Claude Code skills, Codex skills, plain Markdown prompts, or all three?
- Should `catlas-adoption-doctor` be part of `@catlas/atlas-benchmarks` or a separate package?
- What is the first external data size target beyond the current local benchmark scale?
