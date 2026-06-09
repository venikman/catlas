# Catlas Adoption Contract — PINNED

**Status:** Pinned (Wave 0) · **Version:** `ATLAS_CONTRACT_VERSION = 0.1.0` · **Date:** 2026-06-08

This is the canonical, shared contract every adopter implements and every catlas
implementation slice (Claude Code / Codex / Cursor / Devin) codes against. The
executable source of truth is
[`packages/atlas-react/src/contract/atlasStore.ts`](../../packages/atlas-react/src/contract/atlasStore.ts).
Pin against the version above; it bumps on any breaking change below.

## Decisions (locked)

| # | Decision | Consequence |
|---|----------|-------------|
| D1 | **Access control is upstream.** The atlas layer assumes the caller is already authorized by the host app. We do **not** bake auth into the atlas routes. | P1 reframes from "add auth" to "adopters control which fields cross the boundary + bound the search." `sec-1`/`sec-2` are handled by the store/serving layer, not an auth gate. |
| D2 | **Data access is modular.** Adopters implement the `AtlasStore` interface against their own database. The reference app ships Postgres + demo stores. | `AtlasStore` is the central adoption artifact — "the place for adopters to put in." Reference query functions move behind it. |
| D3 | **HTTP serving is a recommendation, not a mandate.** Call the store functions directly, or wrap a store in the recommended `createAtlasRoutes({ store })`. | The reference routes become one flexible option; the store is the contract, transport is the adopter's choice. |

## 1. The store interface (the modular boundary)

Implement these 7 methods for your database. Grounded in the existing reference
functions in `apps/semantic-atlas/lib/atlas/db.ts`.

| Method | In | Out | Notes |
|--------|----|----|-------|
| `getStats()` | — | `AtlasStats` | corpus size for views list |
| `listViews()` | — | `AtlasView[]` | named projections |
| `listPoints(q)` | `{view, bbox, limit?}` | `AtlasPoint[]` | high-zoom; cap `limit` |
| `listClusters(q)` | `{view, bbox, limit?}` | `AtlasCluster[]` | mid-zoom aggregates |
| `listDensityTiles(q)` | `{view, bbox, limit?}` | `AtlasDensityTile[]` | low-zoom aggregates |
| `getEntity(id)` | `string` | `AtlasEntityDetails \| null` | **adopter controls exposed fields** |
| `search(q)` | `{view, q, limit?}` | `AtlasSearchResult[]` | **must bound scan + count** |

## 2. Data shapes

Canonical types are exported from `@catlas/atlas-react/types`
(`packages/atlas-react/src/lib/atlas/types.ts`): `AtlasView`, `AtlasPoint`,
`AtlasCluster`, `AtlasDensityTile`, `AtlasBbox`, `AtlasEntityDetails`,
`AtlasSearchResult`. The Conformance Kit (Codex, P3) ships a runtime validator +
golden fixtures so a non-TS pipeline can prove conformance.

Contract-only types — `AtlasStore`, `AtlasStats`, `AtlasViewportQuery`, `AtlasSearchQuery`,
`AtlasWorldBounds` — plus `ATLAS_SELECTORS` and `ATLAS_CONTRACT_VERSION` are exported from
`@catlas/atlas-react/contract` (wired in the Claude Code slice).

## 3. World bounds (the coordinate seam)

`AtlasWorldBounds` is the shared agreement between **four** slices that MUST line up:

- **Renderer** (Cursor): a `worldBounds` prop, default `ATLAS_DEFAULT_WORLD_BOUNDS`, drives the zoom/span math instead of the hardcoded `15 / 1.32^zoom` over `[-7,7]`.
- **Density tiler** (Codex): `buildDensityTiles({ worldBounds, tileCount, z })` bins against the same bounds — no baked `-7 / 14 / 8`.
- **Coordinate recipe** (Codex): the data-prep transform normalizes generated `x/y` into the chosen bounds.
- **Conformance validator** (Codex): rejects rows whose `x/y` fall outside the declared bounds.

Default `[-7, 7]` preserves today's behavior; adopters override for their extent.

**Reference span formula** (pin it so the renderer and the tiler/recipe can't drift). The
reference renderer (`bboxForViewport`) today hardcodes the default-world case:

```
spanX = 15 / 1.32^zoom          // base 15 is tuned for the default world width of 14
spanY = spanX * 0.72            // 0.72 = viewport aspect ratio (height : width), not a world ratio
bbox  = { center ± spanX/2, center ± spanY/2 }   // rounded to 4 dp
```

Parameterized by `worldBounds` (what Cursor implements), preserving today's default framing:

```
A          = 0.72                    // viewport aspect ratio (height : width), fixed by the canvas — not a world ratio
margin     = 15 / 14                 // ~7% breathing room (from the default tuning)
worldWidth = maxX - minX
spanX      = worldWidth * margin / 1.32^zoom
spanY      = spanX * A
```

**Tall / non-square extents — `spanY` is width-derived on purpose.** Because `A` is fixed by the
canvas, the renderer **width-fits** at zoom 0. A world taller than `A * worldWidth` (≈ 0.72 × width)
does *not* fully fit at zoom 0 — its extra height is reached by panning. (Thanks @codex — the earlier
"any extent fits" wording was wrong for tall bounds.) The tiler and validator still cover the **full**
`worldBounds` regardless of framing. Two ways to handle a tall extent, preferred first:

1. **Coordinate recipe (Codex):** normalize `x/y` into an extent whose aspect ratio is ≲ `A`, so the
   zoom-0 frame shows everything relevant. Keeps the default framing — recommended.
2. **Renderer (Cursor), optional:** fit the *limiting* dimension at zoom 0
   (`spanX0 = max(worldWidth, worldHeight / A) * margin`). Guarantees tall worlds fit, but **changes
   the default square-world framing and the visual baseline** — so it's a renderer decision, not pinned.

The cross-slice agreement is fundamentally the **extent** (`worldBounds`); the tiler and validator
need only that. The formula is the renderer's reference so its `worldBounds` generalization is unambiguous.
To make it normative rather than prose, Cursor's renderer exports `viewSpanForWorldBounds(zoom, worldBounds)`
(and `bboxForViewport(viewport, worldBounds)`); the tiler and recipe import those instead of re-deriving
the math, so the slices cannot drift by construction.

## 4. Selector contract

`ATLAS_SELECTORS` is the one canonical registry; benchmarks, examples, and docs import
it. Cursor's slice makes the renderer DOM emit each exactly once and updates both
README snippets to use `graph = [data-testid="atlas-canvas"]`. It also reconciles the
other scattered selectors into this registry (or marks them host-app-local): the
`consumer-root` test-id in `examples/`, and `atlas-root` in `docs/atlas-visual-system.md`.

Changing a selector **value** is a contract bump (§6) requiring a coordinated PR across Cursor (DOM),
Claude Code (benchmarks), and Codex (export) — never an unversioned string edit in one place.

## 5. The field boundary (replaces auth)

Because access is upstream (D1), the protection that matters is **which fields cross
the boundary**. There are two distinct layers — keep them separate:

- **Store layer** — `AtlasStore.getEntity` returns the full `AtlasEntityDetails` the
  store *chooses* to expose. This is the adopter's first control point: their store
  reads only the columns they're willing to serve.
- **Serving layer** — the recommended routes apply a `lightweightEntity()` **projection**
  before responding, mirroring the existing `lightweightPoint` / `lightweightCluster`
  shapers in `responseShaping.ts`. This is the allow-list for anonymous + cacheable
  responses.

> **Why `lightweightEntity` is *not* a method on `AtlasStore`:** projection is a serving
> concern, not a data-access one. Putting it on the store would force every adopter to
> implement two near-identical entity reads. The store returns the record; the serving
> layer trims it. (Claude Code, P1.)

**`metadata` and `payloadSummary` are adopter-controlled bags, not a forced leak.**
`AtlasEntityDetails` requires both fields (the renderer's inspector reads them), so a store
cannot *omit* them — but it fully controls their **contents**: return `metadata: {}` /
`payloadSummary: ""` for a locked-down entity, or populate only safe fields. `lightweightEntity()`
further whitelists `metadata` keys (and can drop `payloadSummary`) for anonymous responses and
still returns a valid `AtlasEntityDetails`. So no separate "lite" type and no extra store method
are needed — the type forces each field to **exist**, never to be **populated**.

Shipped: `lightweightEntity()` lives in `responseShaping.ts` (Claude Code, P1) and the reference
entity route returns it. It passes the synthetic reference metadata through by default; adopters
with real records pass a `metadataAllowList` and set the entity TTL accordingly. `search` now
bounds its candidate scan via `ATLAS_MAX_SEARCH_CANDIDATES` (`sec-2`): it caps how many matching
rows are scored before ranking, so an anonymous request can't scan a whole view. Per-IP/per-view
throttling stays the host app's job (D1).

## 6. Stability

`ATLAS_CONTRACT_VERSION` follows semver intent:

- **Non-breaking (minor/patch):** adding an *optional* field to a shape; adding a new
  export; widening an input.
- **Breaking (major bump):** removing/renaming/retyping a field; changing an `AtlasStore`
  method signature; changing an `ATLAS_SELECTORS` value or the `AtlasWorldBounds` semantics.
- The reference `/api/atlas/*` route shapes are **illustrative, not contractual** — adopters
  own their transport (D3). The contract surface is the types + `AtlasStore` + selectors.

---

*Pinned as the first coordination step. Changing any section above is a contract
change → bump `ATLAS_CONTRACT_VERSION` and notify all four slice owners.*
