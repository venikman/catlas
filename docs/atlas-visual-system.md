# Semantic Atlas Visual System

## Target

The atlas should read as a semantic landscape, not as a generic scatterplot or dashboard. The current target is the public Nomic Atlas Twitter map and the PubMed biomedical landscape: a light map canvas, dense multicolor point texture, sparse label hierarchy, minimal floating chrome, and zoom/pan interaction that keeps the map as the primary object.

This document describes the current visual contract. It does not change the data-fetching contract: low zoom stays aggregate-based, medium zoom stays cluster-based, and high zoom uses bounded viewport points.

## Renderer Choice

The current renderer uses Canvas 2D for dense map texture and SVG for labels, contours, target markers, and bounded hit/overlay geometry. This matches the Nomic/PubMed direction better than an all-SVG map while preserving the no-WebGL safety rail.

The core safety invariant is not "SVG forever." The real invariant is: do not render unbounded points as React/DOM elements, do not fetch raw points below high zoom, and do not ship heavy bulk metadata.

## Layers

| Layer | Purpose | Current implementation |
|---|---|---|
| Background | Quiet map surface | Pale gray canvas with minimal wash and very faint grid |
| Density / islands | Low-zoom semantic tissue | Canvas 2D deterministic density stipple plus grouped SVG region blobs |
| Contours | Topographic/brain-like structure | Irregular cluster contour rings |
| Clusters | Medium-zoom neighborhoods | Soft cluster halo, bubble, center, and hit target |
| Branches | Neighborhood connectivity | Bounded synthetic curves from cluster centers to representative points |
| Points | High-zoom entities | Bounded Canvas 2D points with canvas hit-testing for hover and selection |
| Labels | Hierarchical topic reveal | Density and cluster labels with collision suppression |
| Interaction overlay | Search and selection feedback | Floating search, compact zoom dock, target marker, hover halo, selected ring, lazy inspector |

## Zoom Stages

The visual fade model lives in `lib/atlas/layerOpacity.ts`.

- Low zoom: density stipple, soft regions, contours, and major region labels dominate. Raw points stay hidden.
- Medium zoom: clusters and branch curves dominate. Region tissue fades into neighborhoods.
- High zoom: bounded points dominate. Branches remain subtle during the transition so entities feel like leaves rather than disconnected dots.

The API LOD thresholds remain centralized in `lib/atlas/lod.ts`; visual opacity transitions are separate presentation logic and must not weaken LOD route guards.

## Labels

Labels are hierarchical:

- Low zoom: major density labels only.
- Medium zoom: cluster labels.
- High zoom: point labels should remain limited to selected, hovered, or high-priority entities in future work.

The current label helpers sort by importance and suppress collisions. Label count caps live in `lib/atlas/visualConfig.ts`.

## Current Limitations

- Canvas 2D now owns dense density and point texture; SVG still owns contours, labels, clusters, and selected/target overlays.
- Branches are synthetic because the current payload does not include real relationship edges.
- Density regions are approximate organic blobs, not true density isolines.
- High-zoom point labels are not fully implemented yet.
- Density stipple is a bounded visual approximation from aggregate density samples, not the same as rendering every raw entity at low zoom.
- The first-screen chrome is intentionally map-first; the previous persistent left rail is hidden for this pass.

## Reference Gates

The Nomic target is scoped to the map/graph surface only, not the app header, sidebar, search palette, or tooling chrome. Use the generic UI graph evaluator against the map container with a captured Nomic map-only image:

```bash
node packages/ui-graph-evaluator/dist/benchmarks/run-ui-evaluator.js \
  --url=http://localhost:3002 \
  --root-selector='[data-testid="atlas-root"]' \
  --graph-selector='[data-testid="atlas-canvas"]' \
  --overlay-selector='[data-atlas-kind="density-label"]' \
  --interaction=wheel-pan \
  --reference-image=/absolute/path/to/nomic-map-only.png \
  --min-reference-score=55 \
  --strict-reference \
  --gate
```

Current local reference scores from the June 8, 2026 production-server run:

- Twitter map reference: `87.5`, `14 pass / 0 warn / 0 fail`.
- PubMed map reference: `75.5`, `14 pass / 0 warn / 0 fail`.

These scores are not a pixel-perfect clone claim. They are a repeatable regression signal for the traits that matter here: background-relative texture coverage, spatial occupancy, hue variation, overlay persistence, wheel/pan behavior, and console health.

## Future Migration Path

If visual fidelity or density performance hits the Canvas 2D ceiling, keep React for app chrome, search, side panel, and controls, and move the point/density layers to a proven tiled Canvas, raster-tile, vector-tile, or WebGL renderer.

When migrating, convert the no-WebGL tests into renderer-safety tests instead of deleting the safety model.
