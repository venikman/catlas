import type { AtlasStore } from "@catlas/atlas-react/contract";

import {
  getAtlasEntity,
  getAtlasStats,
  listAtlasClusters,
  listAtlasDensityTiles,
  listAtlasPoints,
  listAtlasViews,
  searchAtlas,
} from "./db";

/**
 * The reference `AtlasStore` implementation.
 *
 * It wraps the existing `db.ts` query functions so they satisfy the pinned
 * contract (`@catlas/atlas-react/contract`). The demo/postgres/unavailable
 * switch still lives inside `db.ts` via `getAtlasSourceMode()`.
 *
 * This is the seam from D2: adopters swap in their own `AtlasStore` (backed by
 * their database) and the recommended routes (`createAtlasRoutes`, next step)
 * depend on this interface — not on `db.ts` directly.
 *
 * That this object typechecks as `AtlasStore` is the conformance proof that the
 * reference functions already match the Wave-0 contract.
 */
export const referenceAtlasStore: AtlasStore = {
  getStats: getAtlasStats,
  listViews: listAtlasViews,
  listPoints: listAtlasPoints,
  listClusters: listAtlasClusters,
  listDensityTiles: listAtlasDensityTiles,
  getEntity: getAtlasEntity,
  search: searchAtlas,
};

/**
 * The active store the recommended routes read through. Adopters point the atlas
 * at their own database by returning their own `AtlasStore` here — routes depend on
 * this accessor, not on `db.ts` directly (D2/D3). Swapping this is the migration.
 */
export function getAtlasStore(): AtlasStore {
  return referenceAtlasStore;
}
