# Semantic Atlas Handoff

## What Was Built

This repository contains a verified first MVP prototype of Semantic Atlas as a Next.js 16 App Router application. The root route opens the atlas workspace directly, not a landing page.

The current prototype includes:

- A Light Research Atlas interface with left view/layer rail, floating search palette, right inspector, bottom LOD strip, and off-white map surface.
- No-WebGL SVG/CSS atlas renderer to avoid Firefox and macOS WebGL diagnostics.
- View switching, pan, wheel zoom, labels, contour rings, cluster islands, point hover, point selection, search fly-to, and entity/cluster inspector states.
- Bounded API routes for views, density, clusters, points, entity metadata, and search.
- Shared validation and LOD helpers.
- Postgres migrations with optional PostGIS migration.
- Deterministic synthetic atlas generation and seeding scripts.
- Centralized visual configuration for density, clusters, labels, points, transitions, and target markers.
- Production-hardening helpers for runtime limits, cache TTLs, `Server-Timing`, stable response metadata, smoke tests, load tests, and query-plan inspection.
- Unit and regression tests, including no-WebGL, visual-config, and transition-settling guards.

## Architecture Overview

- `app/`: Next.js App Router page and API route handlers.
- `components/atlas/`: Atlas UI surface, SVG renderer, controls, search, inspector, and debug/status components.
- `components/providers/`: TanStack Query provider.
- `lib/atlas/`: Shared atlas types, validation, LOD policy, visual config, runtime config, cache policy, response shaping, query keys, math helpers, rendering helpers, database access, demo store, and synthetic data generation logic.
- `migrations/`: Baseline Postgres schema and optional PostGIS migration.
- `scripts/`: Synthetic data generator, Postgres seeder, atlas stats, smoke, load-test, and query-analysis runners.
- `tests/atlas/`: Validation, LOD, query-key, synthetic-data, visual-config, transition, and no-WebGL regression tests.
- `docs/`: Handoff and continuation notes.

## How To Run Locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

If port `3000` is already occupied, Next.js may use another port. During the latest verification run, the app was served at:

```text
http://localhost:3002
```

Without `DATABASE_URL`, local development uses the deterministic in-memory demo atlas. To force demo mode even when a database URL exists:

```bash
ATLAS_DEMO_MODE=true npm run dev
```

## Verification Commands

Run:

```bash
npm test
npm run typecheck
npm run build
```

Browser/runtime verification should confirm:

- Page title is `Semantic Atlas`.
- No framework overlay is visible.
- The atlas renderer uses SVG, not WebGL.
- `document.querySelectorAll("canvas").length` is `0`.
- `svg[aria-label="Semantic atlas map"]` is present.
- No fresh browser warning/error logs appear after reload.
- Search result selection opens the inspector and switches to point LOD.
- Mobile viewport has no horizontal overflow.

## Current Verification Status

Latest production-hardening verification:

- `npm test`: passed, 19 tests across 8 files.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run atlas:stats`: passed against `http://localhost:3002`.
- `npm run atlas:smoke`: passed against `http://localhost:3002`.
- `npm run atlas:loadtest -- --iterations 12`: passed against `http://localhost:3002`.
- Browser runtime check at `http://localhost:3002/`: passed.

Runtime browser evidence from the latest no-WebGL visual-polish check:

- SVG atlas present.
- `canvasCount: 0`.
- No fresh warning/error logs.
- No framework overlay.
- No horizontal overflow.
- Low zoom rendered density-only summaries with no raw point layer.
- Medium zoom rendered clusters, contours, bounded labels, representative points, and cluster click target markers.
- High zoom settled below the configured raw point cap after transition completion.
- Search result selection opened the inspector with selected point halo and target marker.
- Points endpoint emitted `Server-Timing`, bounded `count/limit/truncated` metadata, and lightweight point payloads without metadata.

## Known Limitations

- The atlas renderer is intentionally no-WebGL. This removes the WebGL warnings but trades away deck.gl-scale rendering performance.
- SVG is suitable for this prototype and capped viewport responses, but it is not the final rendering path for very dense visible point sets.
- The visual surface approximates contour-like density islands with deterministic SVG paths derived from clusters, not true isolines.
- Demo mode uses synthetic data. Real semantic coordinates, labels, and metadata still need product/data integration.
- The inspector content contains prototype copy and synthetic metrics.
- Browser verification is manual through the in-app browser; there is no dedicated Playwright test suite yet.
- The repository currently has a broad MVP surface but no CI configuration.

## Synthetic And Prototype-Level Areas

- Demo data is generated deterministically from synthetic clusters.
- Search results are lightweight and partially presentation-shaped for the mock.
- Cluster summaries, top terms, neighboring-cluster scores, and some metrics are prototype values.
- Density and contour visuals are precomputed or derived approximations rather than production cartography.
- Production data ingestion and semantic embedding pipelines are not implemented.

## Recommended Next Phase

Current production-hardening pass is complete.

Recommended next phase:

- Decide whether the next pass should focus on real-data integration, deeper scale architecture, or CI/e2e automation.
- For deeper fidelity, replace approximate contour rings with precomputed density isolines or tile-backed density surfaces.
- Add screenshot/browser regression tests once the design target stabilizes.
- Improve mobile composition beyond overlap prevention if mobile is a primary review surface.
- Keep the no-WebGL constraint unless the user explicitly reverses it.

## Risks Before Scaling To 1M Or 10M Points

- SVG cannot render very large visible point counts efficiently. Keep raw point caps small.
- For 1M entities, use PostGIS, precomputed density/cluster summaries, and aggressive viewport/tile caching.
- For dense high-zoom views, consider canvas2D, server-rendered raster tiles, vector tiles, or binary tile payloads while keeping SVG for labels and selected overlays.
- For 10M entities, partition point tables by view and spatial tile.
- Avoid JSON for hot dense point paths at larger scale.
- Precompute multi-resolution clusters and density summaries offline.
- Add CI and browser tests before scaling the implementation surface.

## Checkpoint Notes

This checkpoint is intended as a clean continuation point. It tracks source, config, migrations, scripts, docs, tests, and package lockfile. It should not track `node_modules`, `.next`, generated atlas data, environment files, local database dumps, logs, or editor/OS files.
