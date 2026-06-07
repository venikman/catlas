# Semantic Atlas

First working prototype of a continuous zoomable Semantic Atlas. The app is built as a real atlas workspace rather than a marketing page: the root route opens a map-like SVG atlas with search, view switching, LOD controls, hover/click selection, and a metadata inspector.

The visual target is the selected **Light Research Atlas** concept:

```text
/Users/venikman/.codex/generated_images/019e9ba1-9379-7723-94bf-c53dc97f7633/ig_0d52dc715e42db7e016a23c08b407881968c1ea4e27bf7a638.png
```

## Architecture

- **Frontend:** Next.js 16 App Router, TypeScript, Tailwind CSS, TanStack Query.
- **Renderer:** no-WebGL SVG/CSS atlas layers. The renderer keeps the visual structure from the Light Research Atlas mock while avoiding Firefox and macOS WebGL diagnostics. It supports pan, wheel zoom, labels, contours, cluster islands, point hover, and point selection.
- **Server state:** TanStack Query keys include view, LOD layer, zoom band, and rounded bbox. Fetches receive the provided `AbortSignal`, so stale pan/zoom requests can be cancelled or ignored.
- **Backend:** App Router route handlers validate query params and call Postgres data access functions.
- **Database:** Postgres tables for views, per-view point coordinates, precomputed clusters, and density tiles. PostGIS is optional.
- **Development fallback:** if `DATABASE_URL` is missing in `next dev`, the API uses a deterministic in-memory demo atlas with 170,432 point rows. Production without `DATABASE_URL` returns `503`.

## Schema

Baseline migration:

```text
migrations/001_create_atlas_schema.sql
```

Tables:

- `atlas_views`: available semantic/data-model projections.
- `atlas_points`: one coordinate row per entity per view, with label, type, cluster, importance, summary, and JSON metadata.
- `atlas_clusters`: precomputed cluster summaries by view and LOD level.
- `atlas_density_tiles`: low-zoom density/island payloads by view and tile.

Indexes:

- `atlas_points (view_id, x, y)` for bounded viewport queries.
- `atlas_points (entity_id)` for metadata lookup.
- `atlas_points (view_id, cluster_id)` for cluster joins.
- trigram GIN index on `atlas_points.label` for lightweight search.
- cluster bounds and density tile lookup indexes.

Optional PostGIS migration:

```text
migrations/002_optional_postgis.sql
```

This adds `geometry(Point, 3857)` and a GiST spatial index. The baseline numeric bbox indexes work without PostGIS, but PostGIS is the preferred path for larger spatial workloads.

## API Routes

- `GET /api/atlas/views`
- `GET /api/atlas/density?view=...&zoom=...&minX=...&maxX=...&minY=...&maxY=...`
- `GET /api/atlas/clusters?view=...&zoom=...&minX=...&maxX=...&minY=...&maxY=...`
- `GET /api/atlas/points?view=...&zoom=...&minX=...&maxX=...&minY=...&maxY=...`
- `GET /api/atlas/entity/[id]`
- `GET /api/atlas/search?view=...&q=...`

Raw point queries are blocked below high zoom. Search returns lightweight results first; full metadata is fetched only when an entity is selected.

## LOD Behavior

LOD thresholds live in `lib/atlas/lod.ts`.

- `zoom < 3`: density tiles only.
- `3 <= zoom <= 6`: clusters plus representative points.
- `zoom > 6`: bounded raw points inside the current viewport.

The default caps are:

- density tiles: 240
- clusters: 600
- representative points: 760
- raw points: 5,000
- search results: 20

## Synthetic Data

Generate deterministic clustered data:

```bash
npm run generate:atlas -- --count 10000
npm run generate:atlas -- --count 100000
npm run generate:atlas -- --count 1000000 --batchSize 10000
```

`--count` is entity count. Each entity receives one coordinate row per atlas view, so point rows equal `count * view_count`.

The generator streams JSONL to `.atlas-data/` and aggregates clusters/density summaries as it goes, so million-entity generation does not require holding every point row in memory.

Seed Postgres:

```bash
DATABASE_URL=postgres://user:pass@localhost:5432/catlas npm run seed:atlas -- --count 100000
```

Apply `migrations/001_create_atlas_schema.sql` first. Apply `migrations/002_optional_postgis.sql` when PostGIS is available.

For a disposable local Postgres benchmark database:

```bash
docker compose -f docker-compose.postgres.yml up -d
export DATABASE_URL=postgres://atlas:atlas@localhost:54322/atlas_bench
npm run db:migrate
npm run atlas:seed -- --count 42500 --reset --yes
npm run atlas:db:stats
npm run bench:atlas:db
```

The local benchmark seed command uses 42,500 entities because the current
4-view synthetic generator writes 170,000 point rows. Use `--count 170000` for
a larger 170k-entity stress dataset.

## Local Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Without `DATABASE_URL`, local development uses demo mode. To force demo mode even with a database URL:

```bash
ATLAS_DEMO_MODE=true npm run dev
```

## Verification

```bash
npm test
npm run typecheck
npm run build
```

Important acceptance checks:

- Initial load does not fetch all point rows.
- Low zoom fetches density only.
- Medium zoom fetches clusters and representative points.
- High zoom fetches capped viewport points only.
- Pan/zoom requests are debounced and keyed by view, LOD, zoom band, and bbox.
- Hover/click/search/side panel work in the no-WebGL SVG atlas.

## Operational Hardening

Copy the example environment file and set values for the target environment:

```bash
cp .env.example .env
```

Useful runtime controls:

- `ATLAS_MAX_POINTS_PER_RESPONSE`
- `ATLAS_MAX_CLUSTERS_PER_RESPONSE`
- `ATLAS_MAX_REPRESENTATIVE_POINTS_PER_RESPONSE`
- `ATLAS_MAX_DENSITY_TILES_PER_RESPONSE`
- `ATLAS_MAX_SEARCH_RESULTS`
- `ATLAS_ENABLE_SERVER_TIMING`
- `ATLAS_DEBUG`
- `NEXT_PUBLIC_ATLAS_DEBUG`
- `ATLAS_CACHE_TTL_LOW_ZOOM`
- `ATLAS_CACHE_TTL_MEDIUM_ZOOM`
- `ATLAS_CACHE_TTL_HIGH_ZOOM`

Smoke and performance scripts expect a running server:

```bash
ATLAS_BASE_URL=http://localhost:3002 npm run atlas:stats
ATLAS_BASE_URL=http://localhost:3002 npm run atlas:smoke
ATLAS_BASE_URL=http://localhost:3002 npm run atlas:loadtest -- --iterations 90
DATABASE_URL=postgres://user:pass@host:5432/catlas npm run atlas:analyze-queries
```

`atlas:analyze-queries` reads `benchmarks/sql/explain-atlas-queries.sql`.

Production notes:

```text
docs/atlas-production.md
```

The hardening notes cover API bounds, Server-Timing headers, cache policy, required indexes, query-plan inspection, monitoring, smoke tests, and the path from 170k to 1M/10M points.

## Scale Notes

Prototype-ready:

- bounded route handlers
- indexed bbox queries
- precomputed cluster and density layers
- no-WebGL SVG rendering with capped viewport data
- streaming generator and seeder

For 1M entities:

- keep PostGIS enabled
- precompute density and cluster summaries offline
- use aggressive bbox/tile cache headers
- keep raw point caps small
- consider server-rendered raster tiles, canvas2D, or binary tile payloads for high-zoom dense point views

For 10M entities:

- move to vector-tile or binary tile payloads
- partition point tables by view and spatial tile
- precompute multi-resolution clusters
- avoid JSON for hot point paths
- add server-side cache/materialized views for density and cluster endpoints
- keep SVG for labels, controls, and selected entities rather than dense raw point rendering
