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

## 3. World bounds (the coordinate seam)

`AtlasWorldBounds` is the shared agreement between **four** slices that MUST line up:

- **Renderer** (Cursor): a `worldBounds` prop, default `ATLAS_DEFAULT_WORLD_BOUNDS`, drives the zoom/span math instead of the hardcoded `15 / 1.32^zoom` over `[-7,7]`.
- **Density tiler** (Codex): `buildDensityTiles({ worldBounds, tileCount, z })` bins against the same bounds — no baked `-7 / 14 / 8`.
- **Coordinate recipe** (Codex): the data-prep transform normalizes generated `x/y` into the chosen bounds.
- **Conformance validator** (Codex): rejects rows whose `x/y` fall outside the declared bounds.

Default `[-7, 7]` preserves today's behavior; adopters override for their extent.

## 4. Selector contract

`ATLAS_SELECTORS` is the one canonical set; benchmarks, examples, and docs import
it. Cursor's slice makes the renderer DOM emit each exactly once and updates both
README snippets to use `graph = [data-testid="atlas-canvas"]`.

## 5. The field boundary (replaces auth)

Because access is upstream (D1), the protection that matters is **which fields the
store returns**. Today `getEntity` returns `metadata`/`payloadSummary` verbatim
(`sec-1`). Required (Claude Code, P1): a `lightweightEntity()` projection so the
adopter's store decides exactly what is exposed, and a documented note that the
reference entity route is anonymous + cacheable — set TTL / field set accordingly.
`search` must bound its candidate scan (`sec-2`).

---

*Pinned as the first coordination step. Changing any section above is a contract
change → bump `ATLAS_CONTRACT_VERSION` and notify all four slice owners.*
