/**
 * Catlas adoption contract — PINNED (Wave 0).
 *
 * This is the single seam every adopter implements and every catlas slice codes
 * against. It is intentionally types-only (no `pg`, no Next, no runtime deps) so
 * it can be imported from a server, an edge function, a test, or a codegen step.
 *
 * Decisions locked for this contract (see docs/adoption/CONTRACT.md):
 *   1. Access control is UPSTREAM. The atlas layer assumes the caller is already
 *      authorized by the host app; it does not implement auth. Adopters decide
 *      which fields cross the boundary via their store implementation.
 *   2. Data access is MODULAR. Implement `AtlasStore` against your own database.
 *      The reference app ships a Postgres and a demo implementation; you write
 *      your own. This interface is the "place for adopters to put in".
 *   3. HTTP serving is a RECOMMENDATION, not a mandate. Call these functions
 *      directly (server components, RPC, GraphQL) or wrap a store in the
 *      recommended `createAtlasRoutes({ store })` — your choice.
 *
 * Grounded in the existing reference functions in
 * apps/semantic-atlas/lib/atlas/db.ts (listAtlasViews / listAtlasPoints /
 * listAtlasClusters / listAtlasDensityTiles / getAtlasEntity / searchAtlas /
 * getAtlasStats) — the demo/postgres switch becomes "pick your store".
 */
import type {
  AtlasBbox,
  AtlasCluster,
  AtlasDensityTile,
  AtlasEntityDetails,
  AtlasPoint,
  AtlasSearchResult,
  AtlasView,
} from "../lib/atlas/types";

/** Bump on any breaking change to the shapes, the store interface, or the selector contract. */
export const ATLAS_CONTRACT_VERSION = "0.1.0" as const;

export type AtlasStats = {
  /** Implementation-defined; reference uses "postgres" | "demo" | "unavailable". */
  source: string;
  entityCount: number;
  pointRows: number;
};

/** Bounded viewport query. `bbox` must be validated and `limit` capped by the store. */
export type AtlasViewportQuery = {
  view: string;
  bbox: AtlasBbox;
  limit?: number;
};

export type AtlasSearchQuery = {
  view: string;
  q: string;
  /** Stores MUST cap candidate scan + result count; search has no spatial bound (see sec-2). */
  limit?: number;
};

/**
 * The modular data boundary. Implement this for your database; everything else
 * in catlas (renderer feed, recommended routes, benchmark gates, conformance
 * kit) is built on top of it.
 */
export interface AtlasStore {
  getStats(): Promise<AtlasStats>;
  listViews(): Promise<AtlasView[]>;
  listPoints(input: AtlasViewportQuery): Promise<AtlasPoint[]>;
  listClusters(input: AtlasViewportQuery): Promise<AtlasCluster[]>;
  listDensityTiles(input: AtlasViewportQuery): Promise<AtlasDensityTile[]>;
  /** Returns the full entity record. The adopter controls which fields are exposed here. */
  getEntity(entityId: string): Promise<AtlasEntityDetails | null>;
  search(input: AtlasSearchQuery): Promise<AtlasSearchResult[]>;
}

/**
 * The coordinate extent your `x`/`y` live in. PINNED as the shared seam between
 * the renderer (worldBounds prop), the density tiler, the coordinate recipe, and
 * the conformance validator — they MUST all agree. Default preserves today's
 * synthetic [-7, 7] behavior; adopters override it for their own extent.
 */
export type AtlasWorldBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export const ATLAS_DEFAULT_WORLD_BOUNDS: AtlasWorldBounds = {
  minX: -7,
  maxX: 7,
  minY: -7,
  maxY: 7,
};

/**
 * The ONE canonical selector set benchmarks, examples, and docs must use.
 * Resolves the round-2 disagreement (README snippets used different graph
 * selectors; the renderer emitted both `atlas-canvas` and `atlas-map-canvas`).
 * Cursor's slice makes the DOM conform so each renders exactly once with these.
 */
export const ATLAS_SELECTORS = {
  /** Outer host wrapper an adopter mounts. */
  root: '[data-testid="semantic-atlas-map"]',
  /** Interactive map/graph surface — what UI benchmarks point at. */
  graph: '[data-testid="atlas-canvas"]',
  /** Density overlay labels. */
  densityLabel: '[data-atlas-kind="density-label"]',
} as const;

export type AtlasSelectorKey = keyof typeof ATLAS_SELECTORS;
