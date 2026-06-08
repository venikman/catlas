# Semantic Atlas Production Notes

## Current Performance Model

Semantic Atlas is LOD-first. The API must never transfer the whole corpus for a viewport. Each zoom band maps to a bounded endpoint:

- Low zoom: density summaries from `atlas_density_tiles`.
- Medium zoom: cluster summaries plus capped representative points.
- High zoom: raw viewport points only, capped by `ATLAS_MAX_POINTS_PER_RESPONSE`.
- Entity metadata: lazy-loaded through `/api/atlas/entity/[id]` only after selection.

The current verified prototype uses deterministic synthetic data with about `170,432` point rows in demo mode. The renderer is intentionally no-WebGL and uses Canvas 2D for dense map texture plus SVG for labels and overlays. This is acceptable for the current capped MVP, but dense 1M/10M paths need tiled aggregate layers and likely raster tiles, vector tiles, WebGL, or another binary-friendly renderer for hot dense point layers.

## LOD Behavior

LOD thresholds live in `lib/atlas/lod.ts`.

- `zoom < 3`: density.
- `3 <= zoom < 6.01`: clusters.
- `zoom >= 6.01`: points.

Low zoom cannot fetch raw points because it would make every pan/zoom request proportional to corpus size. Low and medium zoom must stay aggregate-based for 1M and 10M scale.

## API Safeguards

The atlas API enforces:

- Valid view slugs.
- Finite bbox coordinates.
- Rejection of inverted or excessive bboxes.
- Stricter high-zoom bbox span guard.
- Per-response limits for density, clusters, representative points, raw points, and search.
- Raw point blocking below high zoom.
- Stable error response shape with `error`, `code`, `ok`, `status`, and timing metadata.
- Response metadata: `count`, `limit`, `truncated`, `serverTimingMs`, and detailed `timings`.
- `Server-Timing` headers when `ATLAS_ENABLE_SERVER_TIMING=true`.

Point list responses are intentionally lightweight. They do not include full metadata or summary text. Use the entity endpoint for full details.

## Caching Strategy

Server cache TTLs are controlled by environment variables:

- `ATLAS_CACHE_TTL_LOW_ZOOM`: density summaries.
- `ATLAS_CACHE_TTL_MEDIUM_ZOOM`: clusters.
- `ATLAS_CACHE_TTL_HIGH_ZOOM`: raw viewport points.
- `ATLAS_CACHE_TTL_ENTITY`: entity metadata.
- `ATLAS_CACHE_TTL_SEARCH`: search.

Client cache policy mirrors that shape:

- Density: longest cache, because aggregate low-zoom tiles are stable.
- Clusters: medium cache.
- Points: short cache, because the viewport and bbox change often.
- Entity metadata: longer cache.
- Search: short cache.

If atlas data updates frequently, keep point and search TTLs short and invalidate tile/cluster caches after batch rebuilds.

## Required Indexes

Apply migrations in order:

```bash
psql "$DATABASE_URL" -f migrations/001_create_atlas_schema.sql
psql "$DATABASE_URL" -f migrations/003_harden_atlas_indexes.sql
```

Recommended if PostGIS is available:

```bash
psql "$DATABASE_URL" -f migrations/002_optional_postgis.sql
```

Important indexes:

- `atlas_views(slug)`.
- `atlas_points(view_id, x, y, importance desc)`.
- `atlas_points(entity_id, view_id)`.
- `atlas_points(view_id, cluster_id, importance desc)`.
- trigram indexes on point labels and cluster IDs for search.
- `atlas_clusters(view_id, lod_level, cluster_id)`.
- `atlas_clusters(view_id, lod_level, importance desc, point_count desc)`.
- expression index over density JSON bounds.
- optional PostGIS GiST index on `atlas_points.geom`.

## Query Inspection

Representative query plans live in:

```text
benchmarks/sql/explain-atlas-queries.sql
```

Run:

```bash
DATABASE_URL=postgres://... npm run atlas:analyze-queries
```

Edit the `\set` values in the SQL file to match the slow viewport, search, or entity lookup you are investigating.

## Operational Commands

Run the app:

```bash
npm run dev
```

Smoke test a running server:

```bash
ATLAS_BASE_URL=http://localhost:3002 npm run atlas:smoke
```

Show API/data stats:

```bash
ATLAS_BASE_URL=http://localhost:3002 npm run atlas:stats
```

Run a bounded API load test:

```bash
ATLAS_BASE_URL=http://localhost:3002 npm run atlas:loadtest -- --iterations 90
```

Generate synthetic data:

```bash
npm run generate:atlas -- --count 100000
npm run generate:atlas -- --count 1000000 --batchSize 10000
```

Seed Postgres:

```bash
DATABASE_URL=postgres://... npm run seed:atlas -- --file .atlas-data/synthetic-atlas-100000.jsonl
```

## Monitoring Checklist

Track these at minimum:

- API p50/p95/p99 latency by endpoint and LOD.
- `Server-Timing` validation/query/serialization timings.
- Response bytes by endpoint.
- `count`, `limit`, and `truncated` rates.
- Database slow queries and sequential scans.
- Search latency and no-result rate.
- Entity lookup 404 rate.
- Client request cancellation during pan/zoom.
- Rendered point count and frame/FPS estimates in debug mode.
- Memory pressure during synthetic generation and seeding.

Enable server logging with:

```bash
ATLAS_DEBUG=true
```

Enable the in-app debug panel with:

```bash
NEXT_PUBLIC_ATLAS_DEBUG=true
```

## Scale Plan

### 170k

The current architecture should be fine with numeric bbox filtering, LOD-specific endpoints, and response caps. Keep raw point requests high-zoom only. Demo synthetic data is enough for local smoke testing.

### 1M

Required:

- Stronger Postgres indexes and regular `EXPLAIN ANALYZE` review.
- Precomputed clusters and density summaries.
- Strict response caps.
- Lazy entity metadata.
- Short point cache, longer aggregate cache.
- A dense-rendering path beyond SVG for high-zoom point-heavy views.

PostGIS is preferred if it is available, but the baseline numeric bbox path still works for early validation.

### 10M

Raw point queries alone are not enough.

Required:

- Precomputed multi-resolution tiles, quadtree summaries, vector tiles, static tile cache, or columnar chunks.
- Low and medium zoom fully aggregate-based.
- High zoom bounded by viewport and point limits.
- Partitioning by view and spatial tile.
- Binary or tile payloads for dense layers.
- SVG retained for labels, controls, selections, and overlays only.

## Known Risks

- SVG cannot be the final dense point renderer for 1M/10M visible workloads.
- Current density contours are prototype approximations, not true isolines.
- Search is lightweight and bounded, but production search likely needs full-text or dedicated search indexes.
- There is no auth/access control yet.
- There is no CI pipeline yet.
- Browser smoke coverage is manual plus operational scripts, not full e2e automation.

## Real-Data Integration Still Needed

- Define real semantic coordinate generation.
- Decide refresh cadence and cache invalidation strategy.
- Precompute density and cluster summaries offline.
- Map real metadata into the entity endpoint.
- Add auth if atlas data is not public.
- Add production observability sinks for logs, metrics, and traces.
