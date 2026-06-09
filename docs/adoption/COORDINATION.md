# Catlas Adoption — Implementation Coordination

Single source of truth for the four-agent implementation of the adoption plan
(`docs/atlas-adoption-maturity-plan.md`, merged in #9). Derived from a two-round
multi-agent review (88 findings verified, 0 refuted) and the data-posture decision.

## Locked decisions

See [`CONTRACT.md`](./CONTRACT.md). In short: **D1** access control is upstream
(no auth in the atlas layer), **D2** data access is modular via the `AtlasStore`
interface, **D3** HTTP serving is a recommendation, not a mandate.

## Wave 0 — the pinned contract (this commit)

The shared seam, pinned before branches diverge:
- [`packages/atlas-react/src/contract/atlasStore.ts`](../../packages/atlas-react/src/contract/atlasStore.ts) — `AtlasStore`, `ATLAS_CONTRACT_VERSION`, `AtlasWorldBounds`, `ATLAS_SELECTORS`.
- [`CONTRACT.md`](./CONTRACT.md) — the canonical spec + decision log.

Changing any of these is a contract change → bump the version, notify all owners.

## Slices & owners

| Owner | Slice | Working set (no overlap) |
|-------|-------|--------------------------|
| **Claude Code** | Modular backend boundary + benchmark trust/teach + skills | `apps/semantic-atlas/lib/atlas/*`, `apps/semantic-atlas/app/api/atlas/*`, `packages/atlas-benchmarks/src/{validators,reporters,types}.ts`, new `skills/` |
| **Codex** | Package-side codegen: conformance kit + aggregation + coordinate recipe + pack smoke test | `packages/atlas-react/src/contract/*` (export wiring + validator), `packages/atlas-react/src/lib/atlas/*` (new aggregation files), `examples/atlas-data-prep/`, CI smoke test |
| **Cursor** | Renderer adoption surface | `packages/atlas-react/src/components/atlas/*`, `visualConfig.ts`, `lod.ts` |
| **Devin** | Docs + packaging reconciliation + plan rewrite | `docs/*`, `packages/atlas-react/docs/backend-integration.md`, all `package.json` packaging fields, the plan doc |

### Claude Code
- **Modular boundary (D2/D3):** extract `db.ts`'s 7 functions behind `AtlasStore`; ship `PostgresAtlasStore` + `DemoAtlasStore` + a recommended `createAtlasRoutes({ store })`; routes call a store, not `db.ts` directly.
- **Field boundary (`sec-1`):** add a serving-layer `lightweightEntity()` projection (mirrors `lightweightPoint`/`lightweightCluster`; **not** an `AtlasStore` method) that trims the response; document the entity route is anonymous + cacheable (set TTL/field set per D1).
- **Bounded search (`sec-2`):** cap candidate scan; flag short-query trigram degradation.
- **Gate trust + teach (`testing-2/3/6`, `bench-*`):** unit-test validators / `summarize()` / `percentiles()` / `findings.ts`; add per-check `rationale/fix/docRef`; label load-bearing vs advisory.
- **Skills (Wave 2):** author `catlas-*` `SKILL.md` skills once a real M2 mapping exists.
- **Done when:** routes run off a swappable store; `getEntity` exposes only allow-listed fields; the benchmark fails its own seeded regression and every red row prints why/fix/doc.

### Codex
- **Conformance Kit (`contract-3/4`, P3):** runtime validator for `AtlasPoint/Cluster/DensityTile/View` + golden fixtures + `npm run conformance`; stamp `ATLAS_CONTRACT_VERSION` in responses. (The `./contract` export is **already wired by the Claude Code slice** — build the validator on it.)
- **Aggregation (`adopt-3`,`refcode-3`, P2):** extract parameterized `aggregateClusters(points)` + `buildDensityTiles({ worldBounds, tileCount, z })`; kill the `-7/14/8` duplication.
- **Coordinate recipe (`adopt-2`, P2):** `examples/atlas-data-prep` — embeddings → UMAP/PCA → normalized, validated rows within `worldBounds` (normalize to an aspect ratio ≲ 0.72 so the default zoom-0 frame shows the full extent — CONTRACT §3).
- **External-consumption proof (`testing-1`, P5):** `npm pack` + `file:` install smoke test outside the workspace (needs Devin's build hook).
- **Done when:** a non-TS pipeline passes `npm run conformance`; the packed tarball imports cleanly outside the monorepo; recipe coords render in-bounds.

### Cursor
- **`worldBounds` prop (`refcode-1`):** derive span from `AtlasWorldBounds` (default `ATLAS_DEFAULT_WORLD_BOUNDS`); width-fits at zoom 0 with fixed viewport aspect — tall extents pan, or optionally fit-to-limiting-dimension (CONTRACT §3 trade-off); export a canonical `viewSpanForZoom(worldBounds, zoom)` the tiler/recipe import (anti-drift, CONTRACT §3).
- **5-state matrix (`rendererapi-1`):** `status` prop + `emptyState/errorState/loadingOverlay` slots + `capped/renderedCount`.
- **Controlled footgun (`rendererapi-3`):** dev-warn when `viewport` passed without `onViewportChange`.
- **A11y (`rendererapi-5`):** focusable map, arrow-pan / `+`/`-` zoom, accessible names on clusters/points.
- **Selectors (`contract-2`):** make the DOM emit `ATLAS_SELECTORS` exactly once each; export the constant; (`rendererapi-2/4`) auto-derive `lod` from zoom; add a theme/palette prop or document the themeable surface.
- **Done when:** fixtures in `[0,1]` and `[-100,100]` both render through zoom; empty/error/loading are distinct; map is keyboard-operable; benchmarks import the selector constant.

### Devin
- **Reconcile (`docacc-1`,`design-7`/`prod-5`,`prod-1/2`,`contract-1`):** fix the broken `benchmarks/sql/` path in all 3 places; assert every doc npm-script resolves; make M5 extend `atlas-production.md`; declare `backend-integration.md` canonical; define aggregate refresh/orphan-cleanup semantics.
- **Packaging (`deps-1..5`):** `prepublishOnly` plus pack-time `prepack`/`prepare` build hooks (publish/pack currently ships empty); normalize React peer to `^18.3.0 || ^19.0.0` + `@types/react` optional + drop `react-dom` peer; decide `atlas-benchmarks` internal vs installable; add `engines.node`; add npm-audit line to evidence template.
- **Plan rewrite (`goal-*`/`skills-*`):** invert phases (skills first); rewrite the maturity table (M0/M1 = baseline-done, a working skill as M1/M2 deliverable); adoption-centric "Done when"; delete `agent-playbooks.md`; bind FPF to benchmark finding ids; fold in D1–D3.
- **Done when:** every copyable command resolves; clean-clone `npm publish --dry-run` includes `dist/`; the plan leads with skills.

## Waves & parallelism (~80% parallel)

- **Wave 0 — pin the contract** (merged in #10). Serial. ✅
- **Wave 1 — all four in parallel** against the pinned contract, disjoint working sets above.
- **Wave 2 — two hand-offs only:**
  - Codex's pack smoke test waits on Devin's pack-time build hook (`prepack` or `prepare`; `prepublishOnly` alone does not run for `npm pack`).
  - Claude Code's skills + the "educational" benchmark wording wait on Codex's real M2 mapping (a concrete dataset to validate against) + Devin's doc links mapping each benchmark finding ID to the canonical remediation section in the adoption docs.

Everything else finishes in Wave 1.

## Shared-file owners (avoid collisions)

| File | Owner / rule |
|------|--------------|
| `packages/atlas-react/package.json` | Codex adds `exports`; **Devin merges last** with packaging fields (different keys → trivial rebase). |
| `apps/semantic-atlas/scripts/atlas-analyze-queries.ts` | **Devin** (path fix + credential fix together). |
| `docs/atlas-adoption-maturity-plan.md` | **Devin** owns the rewrite; others supply content. |
| `ATLAS_SELECTORS` constant | **Cursor** owns the value/DOM; benchmarks (Claude Code) and examples (Codex) import it. |

## Status

All four slices are complete on `main` plus this branch (which is synced with `main`).
Verified together after the sync: `build:packages`, `typecheck`, all four test suites
(ui-graph 6, atlas-benchmarks 25, atlas-react 49, semantic-atlas 20), `conformance`,
`smoke:pack`, and `npm publish --dry-run` all pass.

- [x] **Wave 0** — contract pinned *(merged in #10)*
- [x] **Claude Code — backend boundary** *(merged in #14)* — `AtlasStore` seam (`store.ts`), `lightweightEntity()` field boundary (`sec-1`), bounded search (`sec-2`).
- [x] **Cursor — renderer surface** *(merged in #15)* — `worldBounds`/`viewSpanForWorldBounds`, 5-state matrix, controlled-footgun warn, keyboard a11y, `ATLAS_SELECTORS` exported, palette theming.
- [x] **Codex — conformance + aggregation + recipe** *(merged earlier; #16 pinned synthetic data in-bounds)* — `npm run conformance` green.
- [x] **Claude Code — benchmark trust + teach** *(this branch)* — `rationale/fix/docRef/loadBearing` on load-bearing checks; reporters print why/fix/doc on every red row; new `percentiles`/`findings`/`reporterTeach`/`seededRegression` tests (the suite now fails its own seeded regression).
- [x] **Devin — packaging** *(this branch)* — `prepack` build hooks on all three publishable packages; `react-dom` peer dropped; `@types/react` optional peer; `engines.node >=18.18`; `atlas-benchmarks` kept installable (CLI `bin`).
- [x] **Codex — external-consumption proof** *(this branch)* — `scripts/pack-smoke.mjs` + `npm run smoke:pack` install the packed tarball outside the monorepo and import it.
- [x] **Devin — docs + plan rewrite** *(this branch)* — skills-first plan (Phase 1 = minimum skill kit), D1–D3 folded in, P/A/P bound to finding IDs, `agent-playbooks.md` removed, `npm audit` in the evidence template; `backend-integration.md` declared canonical + "Aggregate refresh & orphan cleanup" semantics.
- [x] **Claude Code — skills (Wave 2)** *(this branch)* — `.cursor/skills/catlas-adoption-scout` + `catlas-benchmark-gate` `SKILL.md`, validating against the existing M2 data-prep mapping.
- [x] **Codex — `ATLAS_CONTRACT_VERSION` stamping** *(this branch)* — added to `serverTiming.meta()`, so every `/api/atlas/*` response carries `contractVersion` (the one contract item missing from #14).

> Earlier-PR facts confirmed during the sync: the `benchmarks/sql/` paths are correct
> everywhere, `atlas-analyze-queries.ts` guards on `DATABASE_URL`, and the React peer range
> was already `^18.3.0 || ^19.0.0`.
