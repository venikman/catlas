# Catlas Adoption — Cloud Execution Handoff (M0 → M5)

**Status:** Handoff brief · **Drives to:** M5 production readiness · **Contract:** `ATLAS_CONTRACT_VERSION = 0.1.0` · **Date:** 2026-06-08

> **⚠️ Current state — read before executing.** Wave 0 and most of Wave 1 are **already merged to `main`**: the contract conformance runtime (#13), the `AtlasStore` boundary + routes (#14), the renderer adoption surface (#15), store-driven availability (#19), the `./contract` export fix (#18), and a `conformance + typecheck` CI gate (#22). **Do not re-create Wave 1 from scratch** — reconcile against current `main` and verify what already exists before branching. (PR #20 restarted Wave 1 from an older base and ended up conflicting across 12 files as a result.) Treat this brief as the guide for the **remaining** Wave 2 and M2–M5 work.

This is the single, self-contained document you paste into a cloud (ultracode)
workflow to take Catlas from its proven M0/M1 baseline to **M5 production-ready
adoption**, executed by the **four implementation slices** (Claude Code / Codex /
Cursor / Devin) working in parallel. It assumes **no prior conversation context** —
everything an agent needs to plan, build, verify, and sign off is here or linked
from here.

Source-of-truth documents this brief orchestrates (read them; do not duplicate them):

- [`CONTRACT.md`](./CONTRACT.md) — the frozen seam (decisions D1–D3, `AtlasStore`, `worldBounds`, selectors).
- [`COORDINATION.md`](./COORDINATION.md) — slice ownership, working sets, wave order, shared-file rules.
- [`../atlas-adoption-maturity-plan.md`](../atlas-adoption-maturity-plan.md) — the M0–M5 model, required docs/examples, phases, evidence template.
- [`../atlas-production.md`](../atlas-production.md) — production checklist that M5 extends.
- [`../atlas-visual-system.md`](../atlas-visual-system.md) — the renderer's visual contract and reference scores.

---

## 0. How to run this in the cloud

This brief is engine-agnostic. It runs two ways; pick one and announce it in your first action.

**Mode A — one orchestrator, four sub-agents (recommended for a single ultracode session).**
A lead agent reads this whole file, pins the open decisions in §12, then fans out **one
sub-agent per slice** (§5) in **isolated git worktrees** so their disjoint working sets
never collide. The orchestrator owns the merge order (§6) and the final M5 evidence pack (§11).

**Mode B — four named cloud agents, one slice each.**
Hand §5's slice brief for *Claude Code*, *Codex*, *Cursor*, and *Devin* to the matching
cloud agent. Each slice section is self-contained. They coordinate only through this file,
[`CONTRACT.md`](./CONTRACT.md), and the shared-file ownership table (§5.3).

**Invariant for both modes:** the contract (§3) is **frozen**. Touching it is a
contract change → bump `ATLAS_CONTRACT_VERSION` and notify all four slice owners before
any branch diverges. Working sets are disjoint (§5). Merge follows wave order (§6).
**Evidence beats claims** — no maturity level is "done" until §7's gates are green and the
§11 evidence pack is attached.

**Prime directive (First Principles Framework):** separate **Promise** (what docs say
adopters can rely on) from **Ability** (what the code can do today) from **Performance**
(what benchmarks, query plans, and screenshots *prove*). Never promote a level on ability
alone — attach measured evidence or mark the gap.

---

## 0.1 Prerequisites, environment & coordination mechanics

**Before any slice runs:**

- **Node 24.x** recommended (the repo doesn't pin `engines.node` yet — Devin adds it). Verify `node -v ≥ 24`.
- `npm ci` at the repo root (npm 10+, workspaces).
- **Playwright Chromium** for the gates: `npx playwright install chromium`.
- **Postgres** is only needed for M2+. Either skip the DB with `ATLAS_DEMO_MODE=true` (in-memory demo data) for M0/M1/M1.5 and demo-mode gates, or provision a **disposable** Postgres (local or container), set `DATABASE_URL`, and apply the reference migrations (the `semantic-atlas` app ships a `db:migrate` script; sources live in `apps/semantic-atlas/migrations`). **Never** point `DATABASE_URL` at production.

**Who answers §12.** The **orchestrator** (Mode A) or the **human launching this** (Mode B) resolves §12's decisions and records them at the top of [`COORDINATION.md`](./COORDINATION.md) *before* Wave 1 branches are created. Slices do not start until that is posted.

**Worktree mechanics (Mode A).** Wave 1's four slices have largely merged (see §1 *Current state*), so branch each *remaining* workstream — the Wave-2 hand-offs and the M2→M5 climb — off **latest `main`**, then `npm ci` inside each:

```bash
git fetch origin
git worktree add -b work/<stream> worktrees/<stream> origin/main
#   e.g. work/wave2-pack-smoke · work/m2-pilot-adapter · work/m3-styling · work/ci-gates
# list: git worktree list   ·   clean up after merge: git worktree remove worktrees/<stream>
```

**Status & handoff protocol.** Each slice keeps its row in [`COORDINATION.md`](./COORDINATION.md) §Status current: `IN_PROGRESS` → `BLOCKED_ON_<slice>` → `READY` (PR open, gates green) → `MERGED`. **Wave 2 starts only after all Wave 1 PRs are merged** (Codex's pack smoke test needs Devin's build hook; Claude Code's skills need Codex's M2 mapping + Devin's links). If blocked with no movement, **stop and escalate** to the orchestrator/human — never reach into another slice's files.

**Where evidence physically lives.** Gate reports are written into the working tree (§7 paths). **Commit them in the same PR as the code change** and reference the paths in the PR body (§11). Review happens on the PR before merge.

**Gate-failure triage.** (a) Failure in *your* code → fix, re-run the local gate, re-push. (b) Failure in *another slice's* working set → post the log in [`COORDINATION.md`](./COORDINATION.md); don't edit their files. (c) Environmental (missing DB, wrong port, demo vs. live) → record the env state in the evidence pack and decide blocker vs. documented skip.

---

## 1. Mission & definition of done

**Mission.** Turn Catlas from "the ability is proven in the reference app" into a
**documented, benchmarked, production-ready adoption path** that a second product team
can follow to render their own real semantic-map data — and prove it is bounded, styled
correctly, and operationally ready.

**End-state (M5).** All of the following are true and evidenced:

- One named **pilot adopter** has been carried M1 → M2 → M3 → M4 → M5 (or the reference
  app stands in as pilot if §12 selects that).
- The full adoption **doc spine** and **example set** exist (§4, [maturity plan](../atlas-adoption-maturity-plan.md) §"Required Documentation/Example Set").
- All three **gate tiers** are green at the levels they support (§7), with reports committed/attached.
- A copyable **CI workflow** exists (§13) — the repo now ships a minimal `conformance + typecheck` gate (#22); §13 extends it with the Tier-A/B atlas gates.
- The [production checklist](../atlas-production.md) (cache/index/privacy/refresh/scale) is satisfied and linked from M5 evidence.
- The §11 **evidence pack** is complete and passes the §11 review policy.

**Done when:** §13's acceptance checklist is fully checked, every copyable command in the
docs resolves, and `npm run validate` plus all three gates pass from a clean checkout.

**Current state (2026-06-08, `main` @ `45c0cfd`).** Wave 0 and **all four Wave-1 slices have
merged**: Devin's slice (#11), Codex's conformance kit + aggregation + `examples/atlas-data-prep`
(`80b92ad`, contract export tidied in #18), Cursor's renderer adoption surface (#15), and Claude
Code's modular `AtlasStore` (#14).
So this handoff's live job is to **verify the Wave-1 "Done when" tails (§5.2), run the Wave-2
hand-offs (§5.4), and drive the M2 → M5 adoption climb (§10) with a pilot adopter.** Trust the git
log / merged PRs as the real status — `COORDINATION.md`'s checkboxes lag the merges.

---

## 2. Repository ground truth (so you don't have to re-explore)

Monorepo, **npm workspaces** (lockfile v3). Stack: **TypeScript 5.9 · React 19 · Next.js 16 ·
Postgres (pg 8.16) · Vitest 4 · Playwright 1.60**. Node 24 available; no `engines` pin yet (Devin adds one).

| Workspace | Path | Role |
|-----------|------|------|
| `@catlas/atlas-react` | `packages/atlas-react` | Reusable renderer (Canvas 2D + SVG, LOD-aware, **no DB/styling deps**). Exports the contract, types, lod, math, visualConfig. |
| `@catlas/ui-graph-evaluator` | `packages/ui-graph-evaluator` | **Tier A** portable CLI — benchmarks *any* canvas/SVG graph. Texture/hue/occupancy + optional reference-image compare. |
| `@catlas/atlas-benchmarks` | `packages/atlas-benchmarks` | **Tier B** atlas-specific gates: API/LOD/render/payload + clickable audit. 10 validators, 3 profiles. |
| `@catlas/semantic-atlas` | `apps/semantic-atlas` | Next.js + Postgres **reference app**. Serves on **:3002**. Demo-mode fallback when no DB. |
| `examples/atlas-consumer` | `examples/atlas-consumer` | Minimal **Vite** consumer (imports only the renderer). Preview on **:4173**. |

Rendering is **Canvas 2D + SVG, intentionally no WebGL** ("no-WebGL safety rail"). LOD is
three-tier by zoom: **density `< 3` → clusters `3–6` → points `≥ 6.01`**.

---

## 3. The frozen contract (the immovable seam)

Full text: [`CONTRACT.md`](./CONTRACT.md). Executable source:
[`packages/atlas-react/src/contract/atlasStore.ts`](../../packages/atlas-react/src/contract/atlasStore.ts).
Summary every slice codes against:

- **D1 — Access control is upstream.** No auth inside the atlas layer; the host app authorizes the caller. The real protection is *which fields cross the boundary*.
- **D2 — Data access is modular.** Adopters implement the `AtlasStore` interface against their own DB. Reference ships `PostgresAtlasStore` + `DemoAtlasStore`.
- **D3 — HTTP serving is a recommendation.** Call the store directly or wrap it in `createAtlasRoutes({ store })`. Transport is the adopter's choice.

**`AtlasStore` — 7 methods:** `getStats`, `listViews`, `listPoints(q)`, `listClusters(q)`,
`listDensityTiles(q)`, `getEntity(id)`, `search(q)`. `listPoints/Clusters/DensityTiles`
take `{view, bbox, limit?}` and cap; `getEntity` exposes **only allow-listed fields**;
`search` **must bound** its candidate scan.

**`worldBounds`** is the coordinate seam four slices must align on (renderer span math,
density tiler, coordinate recipe, conformance validator). Default `[-7, 7]` on both axes
preserves today's framing; adopters override. The reference span formula is pinned in
[`CONTRACT.md` §3](./CONTRACT.md) — the renderer **width-fits** at zoom 0, so tall extents
pan (handle via the coordinate recipe, preferred).

**`ATLAS_SELECTORS`** is the one canonical DOM registry: root `[data-testid="semantic-atlas-map"]`,
graph `[data-testid="atlas-canvas"]`, densityLabel `[data-atlas-kind="density-label"]`.
Benchmarks, examples, and docs **import the constant** — never hardcode.

**Stability:** additive optional field = minor; removing/retyping a field, changing an
`AtlasStore` signature, or changing a selector/`worldBounds` semantic = **major bump**.
Reference `/api/atlas/*` route shapes are illustrative, not contractual.

---

## 4. The maturity ladder (the plan, in order)

The plan is "climb M0 → M5, attaching the required evidence at each rung." Reproduced from
[the maturity plan](../atlas-adoption-maturity-plan.md); that doc is the canonical wording (Devin
rewrites it in Wave 1 — if rungs shift, the source on the default branch wins).

| Level | Promise | Required evidence (gate) |
|-------|---------|--------------------------|
| **M0** Demo baseline | Synthetic data shows the concept. | App runs; demo-mode benchmarks pass or report explicit skips. *(already true)* |
| **M1** Package adoption | Another React app renders shaped data without importing app code. | Build packages → run consumer fixture → **Tier A** `ui-graph-evaluator --gate` green. Command sequence in §10.1. |
| **M1.5** Data-shape feasibility | A team can test if their data makes sense as an atlas before Postgres work. | ~100 product rows → local JSON fixture → rendered → screenshot/evaluator artifact. |
| **M2** Real-data local adapter | A product maps its own records into views/points/clusters/density/entity. | Data-prep runbook, schema mapping, local/staging seed, `EXPLAIN ANALYZE` samples, bounded API responses. **Never point at production.** |
| **M3** Product-styled integration | Teams style data colors + host chrome without forking renderer internals. | `colorKey` mapping, host `className`/`style` or shell-token examples, selector registry, **visual audit screenshots** (§8). |
| **M4** Benchmark-validated integration | The right gate tier runs before merge; CI optional. | **Tier A** for any canvas; **Tier B** atlas API/LOD/DB validators; full quick/standard profiles for semantic-atlas-compatible shells; **clickable audit** only for semantic-atlas chrome. Repeatable commands + report paths + pass/warn/fail/skip policy + sample CI. |
| **M5** Production readiness | Owners understand the ops work before depending on the atlas at scale. | [`atlas-production.md`](../atlas-production.md) checklist, cache/index plan, privacy review, refresh strategy, scale-budget review. |

**Evidence rule (applies at every rung):** reject any jump from *ability* to *promise*
without *measured* evidence. Example overclaim to refuse: "M4 complete" but only ran
`bench:atlas:quick` **without `--gate`** and attached no report.

---

## 5. Four-slice orchestration (who builds what, in parallel)

From [`COORDINATION.md`](./COORDINATION.md). ~80% parallel. Working sets are **disjoint** —
this is what makes four agents safe at once.

### 5.1 Slice ownership

| Owner | Slice | Working set (no overlap) |
|-------|-------|--------------------------|
| **Claude Code** | Modular backend boundary + benchmark trust/teach + skills | `apps/semantic-atlas/lib/atlas/*`, `apps/semantic-atlas/app/api/atlas/*`, `packages/atlas-benchmarks/src/{validators,reporters,types}.ts`, new `skills/` *(Wave 2)* |
| **Codex** | Conformance kit + aggregation + coordinate recipe + pack smoke test | `packages/atlas-react/src/contract/*` (export wiring + validator), `packages/atlas-react/src/lib/atlas/*` (new aggregation files), `examples/atlas-data-prep/`, CI smoke test |
| **Cursor** | Renderer adoption surface | `packages/atlas-react/src/components/atlas/*`, `visualConfig.ts`, `lod.ts` |
| **Devin** | Docs + packaging reconciliation + plan rewrite | `docs/*`, `packages/atlas-react/docs/backend-integration.md`, all `package.json` packaging fields, the plan doc |

### 5.2 Per-slice brief & "done when"

**Claude Code.** Extract `db.ts`'s 7 functions behind `AtlasStore`; ship
`PostgresAtlasStore` + `DemoAtlasStore` + recommended `createAtlasRoutes({ store })` (routes
call a store, not `db.ts`). Add a serving-layer `lightweightEntity()` projection (mirrors
`lightweightPoint`/`lightweightCluster`; **not** an `AtlasStore` method) and document the
entity route as anonymous + cacheable. Cap `search` candidate scan. Unit-test the
validators / `summarize()` / `percentiles()` / `findings.ts`; add per-check
`rationale/fix/docRef` and label load-bearing vs advisory. **Skills are Wave 2** (after a
real M2 mapping exists). Benchmarks **import** `ATLAS_SELECTORS` from the contract — never hardcode (Cursor owns the value). *Done when:* routes run off a swappable store; `getEntity` exposes
only allow-listed fields; the benchmark fails its own seeded regression and every red row
prints why/fix/doc.

**Codex.** Wire the `./contract` export; runtime validator for
`AtlasPoint/Cluster/DensityTile/View` + golden fixtures + `npm run conformance`; stamp
`ATLAS_CONTRACT_VERSION` in responses. Extract parameterized `aggregateClusters(points)` +
`buildDensityTiles({ worldBounds, tileCount, z })` (kill the `-7/14/8` duplication). Build
`examples/atlas-data-prep`: embeddings → UMAP/PCA → normalized, validated rows within
`worldBounds` (aspect ratio ≲ 0.72 so zoom-0 shows the full extent). **Wave 2:** `npm pack`
+ `file:` install smoke test (needs Devin's build hook). *Done when:* a non-TS pipeline
passes `npm run conformance`; the packed tarball imports cleanly outside the monorepo;
recipe coords render in-bounds.

**Cursor.** Add the `worldBounds` prop (derive span from `AtlasWorldBounds`, default
`ATLAS_DEFAULT_WORLD_BOUNDS`). Add the 5-state matrix (`status` prop +
`emptyState/errorState/loadingOverlay` slots + `capped/renderedCount`). Dev-warn when
`viewport` is passed without `onViewportChange`. A11y: focusable map, arrow-pan / `+`/`-`
zoom, accessible names on clusters/points. Make the DOM emit each `ATLAS_SELECTORS` value
**exactly once**, export the constant, auto-derive `lod` from zoom, add a theme/palette prop
or document the themeable surface. *Done when:* fixtures in `[0,1]` and `[-100,100]` both
render through zoom; empty/error/loading are distinct; the map is keyboard-operable;
benchmarks import the selector constant.

**Devin.** Reconcile docs: fix the broken `benchmarks/sql/` path in all 3 places; assert
every doc npm-script resolves; make M5 **extend** `atlas-production.md`; declare
`backend-integration.md` canonical; define aggregate refresh / orphan-cleanup semantics.
Packaging: `prepublishOnly`/`prepack` build hooks (publish currently ships empty); normalize
React peer to `^18.3.0 || ^19.0.0`; add `engines.node`; add an npm-audit line to the evidence
template. Rewrite the plan (skills-first; M0/M1 = baseline-done; adoption-centric "Done
when"; fold in D1–D3). **Own the full doc spine + example set** ([maturity plan](../atlas-adoption-maturity-plan.md)).
*Done when:* every copyable command resolves; a clean-clone `npm publish --dry-run` includes
`dist/`; the plan leads with skills.

### 5.3 Shared-file owners (collision rules)

| File | Rule |
|------|------|
| `packages/atlas-react/package.json` | Codex adds `exports`; **Devin merges last** with packaging fields (different keys → trivial rebase). |
| `apps/semantic-atlas/scripts/atlas-analyze-queries.ts` | **Devin** (path fix + credential fix together). |
| `docs/atlas-adoption-maturity-plan.md` | **Devin** owns the rewrite; others supply content. |
| `ATLAS_SELECTORS` constant | **Cursor** owns the value/DOM; benchmarks (Claude Code) and examples (Codex) import it. |

### 5.4 Waves

- **Wave 0 — pin the contract.** ✅ Merged (#10).
- **Wave 1 — all four slices, in parallel.** ✅ Substantially merged: Devin (#11), Codex conformance/aggregation/recipe (`80b92ad` + `examples/atlas-data-prep`), Cursor renderer surface (#15), Claude Code modular `AtlasStore` (#14). Remaining: verify each slice's §5.2 "Done when" and close tails.
- **Wave 2 — two hand-offs (next):** Codex's `npm pack` smoke test needs Devin's **pack-time** hook (`prepack`/`prepare` — `prepublishOnly` alone doesn't run on `npm pack`); Claude Code's `catlas-*` skills + "educational" benchmark wording need Codex's real M2 mapping + Devin's finding-ID→doc links.

---

## 6. Cloud execution protocol

1. **Pin decisions first (§12).** Do not let branches diverge until the pilot adopter,
   scale target, and doc-policy questions are answered. These change M2–M5 scope.
2. **Isolate each slice.** One `git worktree` (or cloud branch) per slice, branched off the
   Wave-0 contract commit. Disjoint working sets (§5.1) mean no two agents edit the same file
   except the §5.3 shared files, which follow the ownership rule.
3. **Per-slice loop.** For each slice: (a) implement against the frozen contract; (b) run the
   slice's local gate — `npm run validate` plus the relevant tier in §7; (c) capture evidence
   (§11); (d) open a PR with the evidence pack; (e) mark the slice's box in
   [`COORDINATION.md`](./COORDINATION.md) §Status.
4. **Contract-change protocol.** If a slice believes the contract must change: **stop**, bump
   `ATLAS_CONTRACT_VERSION`, edit [`CONTRACT.md`](./CONTRACT.md), file a `[CONTRACT-CHANGE]` issue
   with the justification, get orchestrator/human sign-off, notify all four owners, and re-baseline
   every branch from the new contract commit. A silent contract edit is the one thing that breaks parallelism.
5. **Merge order.** Wave 1 PRs merge in any order *except* the §5.3 shared-file rule (Codex's
   `exports` before Devin's packaging merge). Then Wave 2 hand-offs. Re-run `npm run validate`
   + all three gates after each merge.
6. **Stop conditions (per agent).** Stop and surface for human input if: a gate fails for a
   reason outside your working set; the contract appears to need a change; a slice needs data
   from another slice before its wave; or you would have to claim a maturity level without the
   §11 evidence. **Never** commit `.env`, DB dumps, credentials, or generated production data;
   **never** run destructive SQL (`DROP TABLE`); **never** point benchmarks at active production.

---

## 7. Verification & gates (what "proven" means)

Three tiers. Each is `--gate`-able (exit code **1** on an error-severity failure; warnings
never block). Severity: `error` blocks the gate, `warn` reports only.

| Tier | Tool | What it proves | Gate command | Report |
|------|------|----------------|--------------|--------|
| **A** (portable) | `@catlas/ui-graph-evaluator` | Any canvas/SVG graph renders: texture coverage, hue variation, occupancy, pan/zoom, optional reference-image score. | `npm run bench:ui -- --url=<url> --gate` (or `npx ui-graph-evaluator … --gate`) | `benchmarks/results/ui-evaluator-latest.json` (+ `…-artifacts/`) |
| **B** (atlas API/LOD/render) | `@catlas/atlas-benchmarks` | Atlas-specific correctness + perf: source invariants, LOD thresholds, API p95, payload bytes, search caps, render FPS, memory, live DB. | `npm run bench:atlas:quick` / `:full`, or `npx atlas-benchmark --profile quick --gate --url=<url>` | `outputs/atlas-benchmarks/latest.json` + `latest.md` |
| **B** (clickable) | `atlas-clickable-audit` | Interactive controls change state: LOD buttons, zoom, fit/home, search, view buttons, layer toggles, inspector, cluster select, viewport wheel/pan. **OntoTwin chrome only.** | `npm run bench:atlas:clickable`, or `npx atlas-clickable-audit --gate --url=<url>` | `outputs/atlas-benchmarks/clickable-audit-latest.json` (+ `clickable-audit-artifacts/`) |

**Profiles:** `quick` (5 reps, 7 validators) · `standard` (20 reps, 9) · `full` (40 reps, 10).
**Validators (10):** `sourceInvariant`, `lod`, `api`, `payload`, `search`, `render`,
`interaction`, `memory`, `dbQuery`, `scale`.

**Hard correctness bounds (`ATLAS_BUDGETS`, error-severity):** `maxViewportPoints=20k`,
`maxClusters=2k`, `maxSearchResults=20`, `densityMaxZoom=3`, `pointsMinZoom=6.01`. Density
cap 240 / clusters 600 / points 5000 per response; points payload hard cap **2 MB**.

**Soft perf budgets (good tier, warn-severity):** API p95 views 100 ms · density/clusters
250 ms · points 300 ms · entity 150 ms · search 300 ms. Render idle ≥ 50 fps, pan/zoom p95
≥ 45 fps, frame p95 ≤ 32 ms, **`maxReactPointComponents=0`** (Canvas+SVG only).
Interaction: hover ≤ 100 ms, click-to-panel ≤ 200 ms, entity details ≤ 500 ms.

**Source invariants (architecture, error-severity, 11 checks):** `client-no-db-import`,
`lod-thresholds-centralized`, `points-low-zoom-guard`, `points-bbox-validation`,
`response-shaping-lightweight`, `runtime-config-exists`, `visual-config-exists`,
`lod-config-centralized`, `search-cap-bounded`, `svg-per-point-anti-pattern`,
`console-spam-free` (warn).

**Which tier at which level:** M1 → Tier A. M2 → Tier B validators (API/LOD/DB) with a
local/staging `DATABASE_URL`. M3 → visual artifacts (§8). M4 → all applicable tiers green
with reports. Clickable audit applies **only** when the adopter ships semantic-atlas chrome; if they
ship no such chrome, **skip** it (a skip is not a failure) — it is not required for M4 acceptance.

**Env overrides:** `ATLAS_BASE_URL`, `ATLAS_DEMO_MODE=true` (demo data, no DB),
`DATABASE_URL` (live Postgres), `BENCH_*` for budget overrides. Pass `--start-server` to let
a gate spawn the dev server itself (waits ≤ 20 s for readiness).

**Local validate gate (every slice runs this):** `npm run validate` =
`build:packages && npm test && npm run typecheck && npm run conformance`. (One-shot atlas gate:
`npm run validate:atlas` builds, starts the server, and runs the quick profile with `--gate`.)

---

## 8. Browser & visual verification (which browser, and how)

Two complementary layers — **automated Chromium gates decide pass/fail; a real Chrome via
Claude-in-Chrome produces human-readable visual sign-off.** Use both.

### 8.1 The deterministic gate engine — headless Chromium (Playwright)

The Tier A/B gates above drive **Playwright (Chromium)** headless. This is the *blocking*
verification: it is reproducible, CI-friendly, and already wired. `@playwright/test 1.60` is
installed at the root, but `packages/atlas-benchmarks/src/playwright/atlas-visual.spec.ts`
and `atlas-interaction.spec.ts` are **empty stubs** — either fill them with `@playwright/test`
screenshot specs (Cursor/Claude Code), or rely on the evaluator's texture/reference-score
analysis. Decide explicitly; do not leave the stubs as silent "coverage."

### 8.2 The exploratory layer — Claude-in-Chrome (visual QA + evidence screenshots)

For M3/M4 visual sign-off and the evidence pack, drive a **real Chrome** with the
Claude-in-Chrome MCP (`mcp__Claude_in_Chrome__*`). It is DOM-aware, so it can click the
real LOD/view/layer controls and capture what a human would see. **If the Claude-in-Chrome MCP isn't
available in your environment, fall back to Playwright headless screenshots (§8.1)** — you lose easy
interactive-control evidence but keep the zoom-band captures.

**Launch targets:**
- Reference app (full chrome): `npm run dev:example` → **http://localhost:3002** (set
  `ATLAS_DEMO_MODE=true` for no-DB runs, or `DATABASE_URL` for real data).
- Consumer (renderer only, M1): `npm run example:atlas-consumer:build && npm run example:atlas-consumer:preview` → **http://127.0.0.1:4173**.

**Visual checkpoints to capture (one screenshot each, into the evidence pack):**

| Zoom band | LOD layer expected | What to verify |
|-----------|--------------------|----------------|
| `z < 3` | **Density** | Stipple texture renders; density labels present (`[data-atlas-kind="density-label"]`); canvas not blank. |
| `z ≈ 5` | **Clusters** | Cluster bubbles + labels; layer crossfade looks right. |
| `z ≥ 6.01` | **Points** | Individual points; `data-atlas-point-count` matches; **no** per-point React/SVG components. |
| any | **Interaction** | Click a cluster → side panel opens (`[data-testid="atlas-side-panel"]`); search returns ≤ 20; LOD buttons toggle `aria-pressed`. |

**Flow:** `navigate` to the URL → `screenshot` the initial frame → use the page controls
(LOD buttons carry `data-atlas-kind="lod-button"`, actions carry `data-atlas-action`) to
walk the three zoom bands → `screenshot` each → confirm the canvas data-attributes
(`data-atlas-density-stipple-count`, `data-atlas-point-context-count`, `data-atlas-point-count`)
are non-zero where expected. Save frames as `before.png`/`after.png` style artifacts and
reference them in §11.

### 8.3 Reference scores (optional visual fidelity)

`ui-graph-evaluator --reference-image <png> --min-reference-score <n>` compares against a
baseline. Interpretation: **> 70** strong fidelity, **50–70** acceptable for early
integration, **< 50** review density data / canvas rendering / chosen baseline. Known
reference baselines: Twitter map **87.5**, PubMed **75.5**. Confirm whether the baseline PNG
is committed before turning this into a hard gate (§12).

---

## 9. Tool inventory (what the cloud agent can use)

**Verification & build**
- `@catlas/ui-graph-evaluator` (Tier A), `@catlas/atlas-benchmarks` + `atlas-clickable-audit` (Tier B).
- `npm run validate` / `build:packages` / `typecheck` / `test` / `conformance`.
- Reference migrations `apps/semantic-atlas/migrations`; `packages/atlas-benchmarks/src/sql/explain-atlas-queries.sql`; Docker Compose Postgres for disposable local validation.

**Browser / MCP**
- **Claude-in-Chrome** (`mcp__Claude_in_Chrome__*`) — real-Chrome visual QA, clicks, screenshots (§8.2).
- **Playwright (Chromium)** — the headless gate engine inside the benchmark tools (§8.1).

**Proposed `catlas-*` tools (optional — build only if docs reveal repeated manual checks, Phase 4; none are required for M5 acceptance):**
`catlas-adoption-doctor` (selectors/boundaries/URL/benchmark readiness),
`catlas-postgres-profile` (read-only source profiling), `catlas-data-prep-check`
(validate transformed rows pre-import), `catlas-evidence-pack` (bundle reports + screenshots
+ query plans + env summary for a PR).

**Agent playbooks (`.cursor/skills/catlas-*/SKILL.md`)** — `catlas-adoption-scout`,
`catlas-benchmark-gate`, `catlas-postgres-prep`, `catlas-styling-adapter`,
`catlas-evidence-reviewer`. Each defines preconditions, allowed path globs, prohibited
actions, stop conditions, and copy-paste validation commands.

---

## 10. Per-level execution recipes (the operational meat)

Phases map onto the maturity ladder. Run them in order; each rung's evidence is §11's pack.

### 10.1 M1 — package adoption (Tier A green)

```bash
npm run build:packages
npm run example:atlas-consumer:build

# Terminal 1 — serve the consumer
npm run example:atlas-consumer:preview            # http://127.0.0.1:4173

# Terminal 2 — Tier A gate
npm run bench:ui -- \
  --url=http://127.0.0.1:4173 \
  --root-selector='[data-testid="consumer-root"]' \
  --graph-selector='[data-testid="semantic-atlas-map"]' \
  --overlay-selector='[data-atlas-kind="density-label"]' \
  --interaction=wheel-pan \
  --gate
```
**Evidence:** Tier A report (`benchmarks/results/ui-evaluator-latest.json`) + a render
screenshot (§8.2). **Done when:** the gate exits 0 and the consumer shows a visible atlas.
**Success target:** clean React adopter reaches a visible render + Tier A report in ≤ 1800 s.

### 10.2 M1.5 — data-shape feasibility (optional checkpoint)

Map ~100 product rows into a local JSON fixture, render through the consumer (or equivalent
host), capture one screenshot/evaluator artifact. **Done when:** the team can decide whether
the atlas shape is plausible *before* starting Postgres work. **Rollback:** if later M2 fails,
fall back to M1/M1.5 evidence and revisit source-schema mapping before changing renderer internals.

### 10.3 M2 — real-data local adapter (Codex recipe + Claude Code store)

Provision a local DB first (§0.1: disposable Postgres or staging replica). The data-prep flow below
is Devin-owned and may move during Wave 1 — read the latest from the default branch.
Follow the [Postgres data-prep flow](../atlas-adoption-maturity-plan.md) (inventory → choose
views → generate coords → shape lightweight points → precompute clusters/density → indexes →
bounded endpoints → `EXPLAIN ANALYZE` → local DB validation → record residual risks). Use
`ATLAS_LOD_CONFIG` from `@catlas/atlas-react/lod` as the threshold source. Point
`DATABASE_URL` at a **local seed / disposable container / read-only staging replica — never
production.** Then:

```bash
DATABASE_URL=postgres://… npm run dev:example      # :3002 with real data
npx atlas-benchmark --profile standard --gate --url=http://localhost:3002   # Tier B API/LOD/DB
```
**Evidence:** data-prep runbook, schema mapping, seed, `EXPLAIN ANALYZE` samples, Tier B
report, `DATABASE_URL` status line. **Done when:** API responses are bounded and query-plan
evidence exists without production data.

### 10.4 M3 — product-styled integration (Cursor surface)

Map product categories to `colorKey` on points/clusters (require `colorKey` on every
`AtlasCluster`); apply host `className`/`style` or shell tokens; keep search/inspector/panels
*outside* `@catlas/atlas-react`. Keep density/point/cluster/label/selected states visually
distinct. **Evidence:** before/after **visual screenshots** (§8.2) + the selector registry.
**Done when:** styling is product-owned, no renderer internals forked, and visual artifacts
are attached.

### 10.5 M4 — benchmark-validated integration (all tiers + CI)

```bash
npm run dev:example &                                   # :3002 (or --start-server)
npx ui-graph-evaluator --url=http://localhost:3002 --gate          # Tier A
npx atlas-benchmark --profile full --gate --url=http://localhost:3002   # Tier B
npx atlas-clickable-audit --gate --url=http://localhost:3002       # Tier B, OntoTwin chrome only
```
**Evidence:** all three reports + the §13 CI workflow committed + benchmark-interpretation
notes. **Done when:** every applicable gate is green from a clean checkout and at least one
benchmark finding drove a concrete fix or a documented accepted warning (not just a badge).

### 10.6 M5 — production readiness (Devin extends production guide)

Satisfy [`atlas-production.md`](../atlas-production.md): cache TTLs per layer, required
Postgres indexes (view slug; points `(view_id,x,y,importance)`; cluster
`(view_id,lod_level,cluster_id)`; trigram on labels), privacy/field-boundary review,
aggregate refresh + orphan-cleanup strategy, scale-budget review against the chosen
170k/1M/10M tier. **Evidence:** completed production checklist linked from the evidence pack;
scale validator run/notes. **Done when:** owners can articulate the ops work before depending
on the atlas at scale, and §13 acceptance is fully checked.

---

## 11. Evidence pack & review policy

Attach this to every adoption PR (from [the maturity plan](../atlas-adoption-maturity-plan.md) §Evidence Template):

- [ ] **[M0+]** Product/app route and local URL used for validation.
- [ ] **[M0+]** Package and app commands run.
- [ ] **[M0+]** Benchmark tier, commands run, and report paths.
- [ ] **[M0+]** Known skips, warnings, and residual risks.
- [ ] **[M0+]** Explicit claim scope, in words — e.g. *"advances the reference app to M2 with Tier B API/LOD/DB green; does not claim M3 styling."*
- [ ] **[M2+]** `DATABASE_URL` status: local/staging, skipped, or intentionally absent. **Never** production.
- [ ] **[M2+]** Query-plan evidence (`EXPLAIN ANALYZE`) for real-data paths.
- [ ] **[M3+]** Screenshots or evaluator artifacts for styling/visual changes.
- [ ] **[M4+]** All applicable gate reports + sample CI.
- [ ] **[M5]** Production checklist link + scale-budget review + npm-audit line (Devin adds this field).

**Review policy (Promise / Ability / Performance).** A reviewer (or the
`catlas-evidence-reviewer` playbook) accepts a level only when measured Performance evidence
backs the Promise. Ability + configured tooling is **not** sufficient. Reject any claim that
skips from ability to promise without a report, query plan, or screenshot.

---

## 12. Pinned decisions (defaults — override per pilot owner)

These were unresolved in the source plan and **shape M2–M5 scope**. They are now pinned with
repo-grounded defaults (mirrored in [`COORDINATION.md`](./COORDINATION.md) §Pinned adoption
decisions). A pilot owner may override any of them — if they do, update both places.

| # | Decision | Pinned default | Rationale |
|---|----------|----------------|-----------|
| 1 | **Pilot adopter** | The reference `@catlas/semantic-atlas` app stands in as pilot until a real product is named. | Lets the M2→M5 climb proceed now; swap in a real product/owner/stack when chosen. |
| 2 | **First scale target** | **1M** (of the 170k / 1M / 10M tiers). | 170k ≈ current local scale; 1M is the first meaningful external target; 10M is the stretch. |
| 3 | **Doc policy** | Adoption docs **wrap** (link to) canonical docs; copy only short, stable snippets with a source pointer; full sections link. | Matches the maturity plan's stated rule; prevents source-of-truth drift. |
| 4 | **Exported-type contract** | Start a `CHANGELOG` keyed to `ATLAS_CONTRACT_VERSION` covering the `@catlas/atlas-react` root exports + `/types` shapes (`AtlasPoint/Cluster/DensityTile/View`). | These are the adoption surface; additive optional = minor, signature/field change = major. |
| 5 | **Coordinate fallback** | Normalize via the coordinate recipe (CONTRACT §3, aspect ≲ 0.72). If data truly can't map to stable x/y or aggregate clusters, **stop at M1.5 feasibility** and revisit the view projection — don't force it. | Keeps default framing; avoids fabricating coordinates. |
| 6 | **Promotion authority** | **Peer review** now; the `catlas-evidence-reviewer` playbook once it exists. | Matches §7/§11's review policy; no self-promotion. |
| 7 | **Tool home** | Start `catlas-*` tools **inside `@catlas/atlas-benchmarks`**; extract to a package only if Phase 4 shows real demand. | Avoids premature package proliferation. |
| 8 | **Visual baseline** | **No reference PNG is committed** (verified). Keep `--min-reference-score` **advisory**, not a hard gate; texture/occupancy stay the hard visual gate until a baseline is committed. | The READMEs reference placeholder paths only; a hard gate without a committed baseline isn't reproducible. |
| 9 | **Visual test strategy** | Rely on `ui-graph-evaluator` texture/reference scores + Claude-in-Chrome screenshots (§8.2); **defer** filling the empty `@playwright/test` stubs. | Avoids redundant coverage; revisit if a pixel-diff baseline is needed. |

---

## 13. Acceptance checklist (M5) + leave-behind CI

**M5 acceptance — the handoff is "done" when every box is checked:**

- [x] §12 decisions pinned with defaults (§12) and mirrored in [`COORDINATION.md`](./COORDINATION.md).
- [x] Wave 1 slices merged (#11 Devin · #14 Claude Code · #15 Cursor · `80b92ad`+`atlas-data-prep` Codex) — **verify each slice's §5.2 "Done when"**; then Wave 2 hand-offs; reconcile [`COORDINATION.md`](./COORDINATION.md) §Status (currently lags the merges).
- [ ] Contract untouched (or version bumped + all owners notified).
- [ ] Doc spine + example set exist; every copyable command resolves (Devin's reconciliation done).
- [ ] M1 → M5 evidence packs attached, each passing the §11 review policy.
- [ ] `npm run validate` green from a clean checkout.
- [ ] Tier A + Tier B (API/LOD/DB) + clickable audit (for OntoTwin chrome) all green with committed reports.
- [ ] Visual checkpoints (§8.2) captured at density/clusters/points zoom bands (or Playwright headless screenshots if Chrome is unavailable).
- [ ] [`atlas-production.md`](../atlas-production.md) checklist satisfied and linked.
- [ ] CI workflow below committed and passing.

**Copyable CI skeleton** — the repo now has a minimal `.github/workflows/ci.yml` (conformance +
typecheck, #22). Extend it, or add the sibling below as
`examples/atlas-benchmark-ci/.github/workflows/atlas-gates.yml` (Tier A by default; Tier B
documented as reference-shell-only):

```yaml
name: atlas-gates
on: [push, pull_request]
jobs:
  tier-a-portable:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24' }
      - run: npm ci
      - run: npm run build:packages
      - run: npm run example:atlas-consumer:build
      - run: npm run example:atlas-consumer:preview -- --port 4173 &
      - run: npx wait-on http://127.0.0.1:4173
      - run: |
          npm run bench:ui -- \
            --url=http://127.0.0.1:4173 \
            --root-selector='[data-testid="consumer-root"]' \
            --graph-selector='[data-testid="semantic-atlas-map"]' \
            --overlay-selector='[data-atlas-kind="density-label"]' \
            --interaction=wheel-pan \
            --gate
      - uses: actions/upload-artifact@v4
        with: { name: ui-evaluator-report, path: benchmarks/results/ }
  # Tier B (atlas-benchmark / clickable-audit) is reference-shell-only:
  # run it in the semantic-atlas app job with DATABASE_URL pointed at a
  # disposable seed DB — never production. See §7 and §10.5.
```

---

## 14. Appendix

### Command cheat-sheet

| Goal | Command |
|------|---------|
| Build packages | `npm run build:packages` |
| Full local gate | `npm run validate` |
| Conformance (non-TS proof) | `npm run conformance` |
| Reference app (demo) | `ATLAS_DEMO_MODE=true npm run dev:example` → :3002 |
| Reference app (real data) | `DATABASE_URL=… npm run dev:example` → :3002 |
| Consumer preview | `npm run example:atlas-consumer:preview` → :4173 |
| Tier A gate | `npm run bench:ui -- --url=<url> --gate` |
| Tier B atlas | `npm run bench:atlas:quick` · `:full`, or `npx atlas-benchmark --profile <p> --gate --url=<url>` |
| Tier B clickable | `npm run bench:atlas:clickable`, or `npx atlas-clickable-audit --gate --url=<url>` |
| Tier B DB-only | `npm run bench:atlas:db` (quick profile, `dbQuery` validator) |
| One-shot atlas gate | `npm run validate:atlas` (builds, starts server, quick `--gate`) |

### Report paths

- Tier A: `benchmarks/results/ui-evaluator-latest.json` (+ `ui-evaluator-artifacts/`)
- Tier B atlas: `outputs/atlas-benchmarks/latest.json` + `latest.md`
- Tier B clickable: `outputs/atlas-benchmarks/clickable-audit-latest.json` (+ `clickable-audit-artifacts/`)

### Glossary

- **LOD** — level of detail; zoom-banded layers: density `< 3` → clusters `3–6` → points `≥ 6.01`.
- **Tier A / Tier B** — portable (any canvas) vs. atlas-specific gates.
- **OntoTwin** — the reference app's design-system shell (tokens + kit CSS); **not** a required adopter dependency. Clickable audit's `data-atlas-*` hooks live on this chrome.
- **`worldBounds`** — the coordinate extent all four slices align on; default `[-7, 7]`.
- **Promise / Ability / Performance** — the claim-validation distinction governing every maturity promotion (§11).

### Path index

`docs/adoption/CONTRACT.md` · `docs/adoption/COORDINATION.md` ·
`docs/atlas-adoption-maturity-plan.md` · `docs/atlas-production.md` ·
`docs/atlas-visual-system.md` · `packages/atlas-react/src/contract/atlasStore.ts` ·
`packages/atlas-react/docs/backend-integration.md` ·
`apps/semantic-atlas/lib/atlas/db.ts` ·
`packages/atlas-benchmarks/src/sql/explain-atlas-queries.sql`

---

*Self-contained handoff. To run: paste into a cloud ultracode session, pick Mode A or B (§0),
pin §12, then execute the slices (§5) wave by wave (§6), gating at every rung (§7–§8) and
attaching evidence (§11) until §13 is fully checked.*
