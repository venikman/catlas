# Backend integration for `@catlas/atlas-react`

`SemanticAtlasMap` is a controlled React renderer. Your app owns data fetching, API routes, and persistence. Pass arrays and viewport state into the component; do not import Next.js or `pg` from the package.

## Data contract

Types exported from `@catlas/atlas-react`:

- `AtlasPoint`, `AtlasCluster`, `AtlasDensityTile`
- `AtlasBbox`, `AtlasLodLayer`, `AtlasView`, `AtlasSearchResult`
- `AtlasViewportState`, `LayerToggles`
- `bboxForViewport(viewport)` helper

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
  --graph-selector='[data-testid="semantic-atlas-map"]' \
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
