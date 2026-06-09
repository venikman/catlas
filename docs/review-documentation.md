# Catlas Documentation Review — Component Users

**Scope:** Documentation aimed at users (adopters) of `@catlas/atlas-react`, `@catlas/ui-graph-evaluator`, and `@catlas/atlas-benchmarks`.

---

## 1. Documentation Inventory

| Doc | Path | Primary Audience | Lines |
|-----|------|-----------------|-------|
| Root README | `README.md` | All users | 126 |
| atlas-react README | `packages/atlas-react/README.md` | **Component adopters** | 85 |
| Backend integration | `packages/atlas-react/docs/backend-integration.md` | **Component adopters** | 165 |
| ui-graph-evaluator README | `packages/ui-graph-evaluator/README.md` | Benchmark users | 75 |
| atlas-benchmarks README | `packages/atlas-benchmarks/README.md` | Benchmark users | 170 |
| Example app README | `apps/semantic-atlas/README.md` | Internal / reference | 82 |
| Consumer fixture README | `examples/atlas-consumer/README.md` | Component adopters | 24 |
| Data-prep recipe README | `examples/atlas-data-prep/README.md` | Component adopters | 25 |
| Adoption CONTRACT | `docs/adoption/CONTRACT.md` | Internal / multi-agent | 152 |
| Adoption COORDINATION | `docs/adoption/COORDINATION.md` | Internal / multi-agent | 84 |
| Adoption maturity plan | `docs/atlas-adoption-maturity-plan.md` | Internal planning | 383 |
| Benchmarks guide | `docs/atlas-benchmarks.md` | Benchmark users | 199 |
| Postgres benchmarks | `docs/atlas-postgres-benchmarks.md` | DB benchmark users | 111 |
| Visual system | `docs/atlas-visual-system.md` | Internal / design | 85 |
| Production notes | `docs/atlas-production.md` | Ops / production | 217 |
| Handoff doc | `docs/SEMANTIC_ATLAS_HANDOFF.md` | Internal handoff | 155 |
| Design QA | `apps/semantic-atlas/design-qa.md` | Internal QA log | 64 |

---

## 2. Strengths

### Well-Covered Areas
- **Quick-start path exists.** `atlas-react/README.md` has a working import example, prop list, and controlled-viewport example. A new adopter can get a render in < 5 minutes.
- **Backend integration is comprehensive.** `backend-integration.md` covers the data contract, Postgres schema, API shape, adapter pattern (with TanStack Query example), seeding, selectors, and conformance — all in one canonical file.
- **Benchmark tooling is well-documented.** Both `ui-graph-evaluator` and `atlas-benchmarks` READMEs provide CLI examples for every major mode (basic gate, artifacts, overlays, strict texture, reference images).
- **Type exports are accurate.** The documented types (`AtlasPoint`, `AtlasCluster`, `AtlasDensityTile`, `AtlasView`, etc.) match the actual source in `types.ts`. Import paths in docs match `package.json` exports.
- **Maturity model is thorough.** M0–M5 with evidence requirements gives adopters a clear roadmap.
- **Contract is pinned and versioned.** `CONTRACT.md` and the `AtlasStore` interface in `atlasStore.ts` provide a stable adoption seam with versioning policy. v0.2.0 (#19) added optional `isAvailable?()` readiness check with a changelog entry.

### Documentation Quality
- Copyable commands throughout.
- Consistent code blocks with correct syntax.
- Cross-linking between docs is generally good.

---

## 3. Issues — Accuracy & Correctness

### 3.1 ~~Duplicate/conflicting `./contract` export in package.json~~ — FIXED in #18
**Status: Resolved.**

The duplicate `"./contract"` key that shadowed the barrel export has been collapsed in PR #18 (`45c0cfd`). The barrel at `contract/index.ts` is now the sole entry point.

### 3.2 Props documentation is incomplete vs. actual component
**Severity: Medium.**

`atlas-react/README.md` lists 8 props. The actual `SemanticAtlasMapProps` has **23 props**. Missing from docs:
- `bbox`, `capped`, `className`, `emptyState`, `errorState`, `hoveredEntityId`, `loadingOverlay`, `renderedCount`, `selectedEntityId`, `status`, `style`, `targetMarker`, `theme`, `worldBounds`

Several of these are important for adopters (e.g., `status` for loading/error states, `worldBounds` for custom coordinate extents, `theme` for palette customization, `className`/`style` for layout).

### 3.3 Selector inconsistency across docs
**Severity: Medium.**

Different docs reference different selectors for the same element:
- Root README uses `--root-selector='[data-testid="consumer-root"]'` and `--graph-selector='[data-testid="atlas-canvas"]'`
- `apps/semantic-atlas/README.md` uses `--root-selector='[data-testid="atlas-root"]'` and `--graph-selector='[data-testid="atlas-canvas"]'`
- `docs/atlas-visual-system.md` uses `--root-selector='[data-testid="atlas-root"]'` and `--graph-selector='[data-testid="atlas-canvas"]'`
- `ATLAS_SELECTORS` constant defines `root: '[data-testid="semantic-atlas-map"]'` and `graph: '[data-testid="atlas-canvas"]'`
- `backend-integration.md` references both `[data-testid="atlas-canvas"]` and `[data-testid="atlas-map-canvas"]`

The `ATLAS_SELECTORS` constant should be the canonical source. Docs should reference it rather than hardcoding selector strings.

### 3.4 Stale report paths
**Severity: Low.**

`atlas-benchmarks/README.md` says reports go to `benchmarks/results/latest.json` (lines 150-151), but the adoption plan (line 284) says atlas benchmarks now write to `outputs/atlas-benchmarks/latest.json`. And `apps/semantic-atlas/README.md` says `outputs/atlas-benchmarks/` (line 64). These need reconciliation.

### 3.5 SEMANTIC_ATLAS_HANDOFF.md has stale port reference
**Severity: Low.**

Handoff doc says `http://localhost:3000` as default (line 49) but then clarifies 3002. The monorepo README and example app README consistently use 3002. The handoff doc predates the monorepo consolidation.

---

## 4. Issues — Gaps & Missing Content

### 4.1 No `docs/adoption/index.md` or `docs/adoption/quickstart.md`
**Severity: High for adopters.**

The maturity plan identifies these as required, and the Phase 0.5 and Phase 1 milestones call for them, but they don't exist yet. An adopter currently has no single entry point — they must discover the right doc from the 16+ files. The adoption directory only has `CONTRACT.md` and `COORDINATION.md` (internal-facing).

### 4.2 No API reference / prop table for `SemanticAtlasMap`
**Severity: High for component users.**

The README lists props in bullet form but doesn't document types, defaults, or required vs. optional status. There's no generated API reference or JSDoc. The most critical component for adopters lacks a proper API table.

Recommended format:
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `clusters` | `AtlasCluster[]` | No | `[]` | Cluster summaries for medium zoom |
| ... | ... | ... | ... | ... |

### 4.3 No installation instructions
**Severity: High for external adopters.**

Neither the atlas-react README nor backend-integration.md mentions how to install the package. There's no `npm install @catlas/atlas-react` because the package isn't published yet, and `prepublishOnly` is the only build hook (no `prepack`). The COORDINATION doc (Devin slice) flags this as a known gap. External adopters need to know the current install path (git submodule, workspace link, or pack/file reference).

### 4.4 No changelog or migration guide
**Severity: Medium (improved).**

The contract now includes a changelog section at the bottom of `CONTRACT.md` (added in #19 with the 0.2.0 bump). However, there's still no standalone CHANGELOG.md or migration guide for tracking changes across the broader package.

### 4.5 No troubleshooting or FAQ section
**Severity: Medium.**

Common adopter questions are unanswered:
- "The canvas is blank" → need explicit parent height
- "Points don't show at low zoom" → LOD system design; density-only at low zoom
- "How do I theme the map?" → `theme` prop + `ATLAS_VISUAL_CONFIG` (undocumented)
- "What React versions work?" → peer dep says `^18.3.0 || ^19.0.0` but this isn't in the README

### 4.6 Missing docs referenced by the adoption plan
**Severity: Medium.**

These docs are referenced as deliverables but don't exist yet:
- `docs/adoption/index.md`
- `docs/adoption/quickstart.md`
- `docs/adoption/data-contract.md`
- `docs/adoption/postgres-data-prep.md`
- `docs/adoption/styling-and-theming.md`
- `docs/adoption/benchmark-gates.md`
- `docs/adoption/benchmark-interpretation.md`
- `docs/adoption/evidence-template.md`
- `docs/adoption/agent-playbooks.md`
- `docs/adoption/maturity-scorecard.md`

These are planned, so this is expected — but worth noting as the current documentation gap for adopters.

### 4.7 `react-dom` peer dependency still present
**Severity: Low.**

The COORDINATION doc (Devin slice, `deps-1..5`) calls for dropping the `react-dom` peer dependency. Currently `package.json` still requires `react-dom: ^18.3.0 || ^19.0.0` as a peer, which may be unnecessary if the renderer only uses React (not ReactDOM directly).

---

## 5. Issues — Structure & Navigation

### 5.1 No single adopter entry point
**Severity: High.**

An external adopter looking at this repo sees 16+ docs across `docs/`, `packages/*/README.md`, `packages/*/docs/`, `apps/*/README.md`, and `examples/*/README.md`. There's no "Start Here" page. The root README is oriented toward internal developers, not adopters of `@catlas/atlas-react`.

### 5.2 Internal docs mixed with adopter docs
**Severity: Medium.**

`SEMANTIC_ATLAS_HANDOFF.md`, `design-qa.md`, `COORDINATION.md`, and most of the maturity plan are internal planning artifacts. They're interleaved with adopter-facing docs like `backend-integration.md` and the package READMEs, creating noise for external users.

### 5.3 Significant content duplication
**Severity: Medium.**

Benchmark commands and CLI options are repeated across:
- `packages/atlas-benchmarks/README.md` (170 lines)
- `docs/atlas-benchmarks.md` (199 lines)
- Root `README.md`
- `apps/semantic-atlas/README.md`
- `docs/atlas-adoption-maturity-plan.md`
- `packages/ui-graph-evaluator/README.md`

Budget tables appear in both `docs/atlas-benchmarks.md` and presumably in the source `budgets.ts`. When values change, multiple docs need updating.

---

## 6. Recommendations — Prioritized

### P0 — Fix before external adopters use the package
1. ~~**Fix the duplicate `./contract` export**~~ — resolved in #18.
2. **Create `docs/adoption/quickstart.md`** — a 1-page "Install → Import → Render → Verify" guide. This is the highest-impact missing doc.
3. **Add a complete props table** for `SemanticAtlasMap` in the atlas-react README or a dedicated API reference page.
4. **Document the installation path** — whether local workspace link, git dependency, or npm pack.

### P1 — Fix before M1 maturity claim
5. **Create `docs/adoption/index.md`** as the decision-tree entry point.
6. **Reconcile selectors** across all docs to reference `ATLAS_SELECTORS` constant.
7. **Reconcile report paths** — one canonical answer for where each tool writes output.
8. **Add React version compatibility** to the atlas-react README.
9. **Document the `theme`/`worldBounds`/`status` props** — these are adoption-critical.

### P2 — Improve before M2+
10. **Separate internal and adopter docs** — move `SEMANTIC_ATLAS_HANDOFF.md`, `design-qa.md`, and `COORDINATION.md` out of the primary docs path (or add "internal" labels).
11. **Add a troubleshooting / FAQ section** for common issues.
12. **Add CHANGELOG.md** tracking contract version bumps.
13. **Deduplicate benchmark docs** — canonical commands in one place, thin pointers elsewhere.
14. **Remove stale handoff port references** and demo-era copy that predates the monorepo.

---

## 7. Summary

The documentation is **strong on the backend integration contract, benchmark tooling, and maturity planning**. The core types are well-defined and the cross-linking is mostly correct.

The main gaps are:
- **No adopter entry point** (`quickstart.md` / `index.md`)
- **Incomplete component API docs** (23 props, only 8 documented)
- ~~Broken `./contract` export~~ (fixed in #18)
- **Selector and report-path inconsistencies** across docs
- **No install instructions** (package not yet publishable externally)

For a team adopting `@catlas/atlas-react` today, the `backend-integration.md` doc is excellent and the maturity plan gives a clear roadmap. But the first 5 minutes of "How do I install this and render a map?" are missing.
