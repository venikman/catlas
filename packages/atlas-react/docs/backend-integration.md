# Backend integration for `@catlas/atlas-react`

> **Canonical source.** This document is the single source of truth for the
> renderer data types, the API shape, the Postgres schema, the adapter pattern,
> seeding, and the benchmark selectors. Adoption docs under `docs/adoption/`
> link here instead of duplicating these definitions. The executable contract is
> [`packages/atlas-react/src/contract/atlasStore.ts`](../src/contract/atlasStore.ts)
> and the decision log is [`docs/adoption/CONTRACT.md`](../../../docs/adoption/CONTRACT.md).
> When a shape changes here, bump `ATLAS_CONTRACT_VERSION` and notify the slice owners.

`SemanticAtlasMap` is a controlled React renderer. Your app owns data fetching, API routes, and persistence. Pass arrays and viewport state into the component; do not import Next.js or `pg` from the package.

## Data contract

Types exported from `@catlas/atlas-react`:

- `AtlasPoint`, `AtlasCluster`, `AtlasDensityTile`
- `AtlasBbox`, `AtlasLodLayer`, `AtlasView`, `AtlasSearchResult`
- `AtlasViewportState`, `LayerToggles`
- `bboxForViewport(viewport)` helper

Runtime contract helpers exported from `@catlas/atlas-react/contract`:

- `validateAtlasContractRows` / `assertAtlasContractRows`
- `aggregateClusters(points, { worldBounds })`
- `buildDensityTiles(points, { worldBounds, tileCount, z })`
- `ATLAS_CONTRACT_GOLDEN_FIXTURES`

LOD layers:

- `density` — low zoom, heatmap/stipple tiles
- `clusters` — medium zoom, cluster islands + representative points
- `points` — high zoom, capped raw points in bbox

Shared LOD thresholds live in `@catlas/atlas-react/lod` (`ATLAS_LOD_CONFIG`, `getLodForZoom`, `shouldFetchPoints`).

## Postgres schema

Migrations in the reference app:

```text
apps/semantic-atlas/migrations/001_create_atlas_schema.sql
apps/semantic-atlas/migrations/002_optional_postgis.sql
apps/semantic-atlas/migrations/003_harden_atlas_indexes.sql
```

Core tables:

| Table | Purpose |
|-------|---------|
| `atlas_views` | Named projections (slug, name, description) |
| `atlas_points` | One coordinate row per entity per view |
| `atlas_clusters` | Precomputed cluster summaries by view + LOD level |
| `atlas_density_tiles` | Low-zoom density/island payloads |

Indexes cover bbox lookups on `(view_id, x, y)`, entity lookup, cluster joins, trigram search on labels, and density tile keys.

## Aggregate refresh & orphan cleanup

`atlas_clusters` and `atlas_density_tiles` are **precomputed aggregates** derived
from `atlas_points`. The schema in `001_create_atlas_schema.sql` only declares an
`on delete cascade` from each aggregate table to `atlas_views(id)` — deleting a
**view** removes its points, clusters, and tiles together. There is **no**
foreign key from an aggregate row to the individual points it summarizes
(clusters key on `(view_id, lod_level, cluster_id)`, tiles key on
`(view_id, z, x_tile, y_tile)`). So when points are inserted, updated, or deleted
*within* a view, the aggregates do not change automatically: they must be rebuilt.

### Refresh cadence (when points change)

1. **Stage point changes first.** Upsert into `atlas_points` keyed on the
   `(entity_id, view_id)` unique constraint; delete rows whose source entities no
   longer exist. Coordinate regeneration uses the data-prep recipe
   (`examples/atlas-data-prep/coordinate-recipe.mjs`) and must keep `x/y` inside
   the declared `worldBounds` (default `ATLAS_DEFAULT_WORLD_BOUNDS`).
2. **Rebuild clusters and density tiles from the new points**, not from raw scans
   at request time. Use the shared, parameterized helpers so a rebuild matches
   what the renderer expects: `aggregateClusters(points, { worldBounds })` and
   `buildDensityTiles(points, { worldBounds, tileCount, z })` from
   `@catlas/atlas-react/contract`. Write the results with upserts keyed on each
   aggregate table's unique constraint so unchanged tiles/clusters are idempotent.
3. **Pick a cadence.** Treat aggregates as a batch product: rebuild on the same
   schedule as coordinate regeneration (offline, per batch), not per write. For
   incremental point edits, rebuild only the affected views. Low/medium zoom must
   stay aggregate-backed at every scale — never fall back to raw point scans to
   "patch" stale clusters.
4. **Invalidate caches after a rebuild.** Once aggregates are rewritten,
   invalidate density/cluster caches (and the entity cache for changed entities).
   See `docs/atlas-production.md` § Caching Strategy and § Real-Data Integration
   Still Needed for the cadence/invalidation contract.

### Orphan cleanup (aggregates whose points were deleted)

Because there is no row-level FK from aggregates to points, deleting points can
leave **orphaned** clusters or density tiles — rows that still describe regions or
groups that no longer have any backing points. Reconcile them as the last step of
every rebuild:

- **Clusters:** delete `atlas_clusters` rows for a view whose `cluster_id` no
  longer appears in `atlas_points` for that `(view_id, lod_level)`, or whose
  recomputed `point_count` would be `0`. The rebuild in step 2 already computes
  the surviving set; delete clusters not in that set within the same transaction.
- **Density tiles:** delete `atlas_density_tiles` rows for a view whose
  `(z, x_tile, y_tile)` key is not present in the freshly built tile set, or whose
  recomputed `point_count` is `0`.
- **Do this transactionally per view** so a partial rebuild never exposes a mix of
  fresh points with stale aggregates. Deleting an entire view continues to rely on
  the `on delete cascade` and needs no manual cleanup.

Treat orphan cleanup as part of the refresh job, not a separate cron: every
points change that triggers a rebuild must also prune the aggregates that the
rebuild no longer produced.

## API shape

Implement routes equivalent to the reference app (`apps/semantic-atlas/app/api/atlas/`):

| Route | Purpose |
|-------|---------|
| `GET /api/atlas/views` | List views + stats |
| `GET /api/atlas/density` | `view`, `zoom`, bbox params |
| `GET /api/atlas/clusters` | `view`, `zoom`, bbox params |
| `GET /api/atlas/points` | High-zoom only; validate bbox + `shouldFetchPoints` |
| `GET /api/atlas/entity/[id]` | Full metadata for selection |
| `GET /api/atlas/search` | `view`, `q` — cap results |

Query validation and response shaping patterns are in the reference `lib/atlas/validation.ts` and `lib/atlas/responseShaping.ts`.

## Adapter pattern

1. Track `viewport` (center, zoom) and `layers` in app state.
2. Derive `lod` with `getLodForZoom(viewport.zoom)`.
3. Compute `bbox` with `bboxForViewport(viewport)` or your own tiling logic.
4. Fetch the matching endpoint; pass arrays into `SemanticAtlasMap`.

TanStack Query example:

```tsx
import { useQuery } from "@tanstack/react-query";
import {
  SemanticAtlasMap,
  bboxForViewport,
  type AtlasViewportState,
} from "@catlas/atlas-react";
import { getLodForZoom } from "@catlas/atlas-react/lod";

function AtlasPanel() {
  const [viewport, setViewport] = useState<AtlasViewportState>({
    centerX: 0,
    centerY: 0,
    zoom: 2,
  });
  const lod = getLodForZoom(viewport.zoom);
  const bbox = bboxForViewport(viewport);

  const { data } = useQuery({
    queryKey: ["atlas", lod.layer, viewport],
    queryFn: ({ signal }) =>
      fetch(`/api/atlas/${lod.layer}?...`, { signal }).then((r) => r.json()),
  });

  return (
    <SemanticAtlasMap
      viewport={viewport}
      onViewportChange={setViewport}
      lod={lod.layer}
      bbox={bbox}
      densityTiles={data?.densityTiles}
      clusters={data?.clusters}
      points={data?.points}
    />
  );
}
```

The full reference shell (`AtlasViewer`) adds search, side panel, and chrome around this pattern in `apps/semantic-atlas/components/atlas/AtlasViewer.tsx`.

## Seeding and local Postgres

```bash
cd apps/semantic-atlas
docker compose -f docker-compose.postgres.yml up -d
export DATABASE_URL=postgres://atlas:atlas@localhost:54322/atlas_bench
npm run db:migrate
npm run seed:atlas -- --count 42500 --reset --yes
```

Environment variables for limits and cache TTLs are documented in `apps/semantic-atlas/.env.example`.

Without `DATABASE_URL`, `next dev` can use deterministic demo mode (`ATLAS_DEMO_MODE=true`).

## Benchmarking the component

Generic graph surface (any host URL):

```bash
npx ui-graph-evaluator \
  --url=http://127.0.0.1:4173 \
  --root-selector='[data-testid="consumer-root"]' \
  --graph-selector='[data-testid="atlas-canvas"]' \
  --overlay-selector='[data-atlas-kind="density-label"]' \
  --interaction=wheel-pan \
  --gate
```

Atlas-specific gates against the reference app:

```bash
npx atlas-benchmark --profile quick --gate --url=http://localhost:3002
npx atlas-clickable-audit --gate --url=http://localhost:3002
```

Selectors for the map surface:

- Root: `[data-testid="semantic-atlas-map"]`
- Canvas: `[data-testid="atlas-canvas"]` or `[data-testid="atlas-map-canvas"]`
- Overlay labels: `[data-atlas-kind="density-label"]`, `[data-testid="atlas-overlay"]`

## Conformance

Run the non-TypeScript contract path from the repository root:

```bash
npm run conformance
```

This builds the package, runs the JavaScript data-prep recipe in
`examples/atlas-data-prep`, validates golden fixtures, and imports the packed
tarball from a temporary consumer outside the monorepo.
