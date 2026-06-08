# @catlas/atlas-react

Reusable React renderer for the Catlas semantic atlas map.

```tsx
import {
  SemanticAtlasMap,
  type AtlasCluster,
  type AtlasDensityTile,
  type AtlasPoint,
} from "@catlas/atlas-react";

const clusters: AtlasCluster[] = [];
const densityTiles: AtlasDensityTile[] = [];
const points: AtlasPoint[] = [];

export function MapPane() {
  return (
    <div style={{ height: 720, width: "100%" }}>
      <SemanticAtlasMap
        clusters={clusters}
        densityTiles={densityTiles}
        layers={{ labels: true, links: true, points: true }}
        lod="points"
        points={points}
      />
    </div>
  );
}
```

This package contains only the map renderer and shared renderer types. It does not include the Catlas Next.js example app, API routes, search UI, side panels, database code, or benchmark runner.

**Backend integration:** schema, API routes, adapter pattern, seeding, and benchmark commands are documented in [`docs/backend-integration.md`](docs/backend-integration.md).

## Props

The renderer accepts pre-shaped atlas data:

- `clusters`: semantic cluster summaries with bounds, label, color, and centroid fields.
- `densityTiles`: aggregate density samples for map-like low/medium zoom texture.
- `points`: visible point records for high-zoom inspection.
- `lod`: `"density"`, `"clusters"`, or `"points"`.
- `layers`: optional toggles for `density`, `clusters`, `points`, `labels`, and `links`.
- `viewport` plus `onViewportChange`: controlled pan/zoom state.
- `initialViewport`: uncontrolled initial pan/zoom state.
- `onSelectPoint`, `onSelectCluster`, `onHoverPoint`, `onHoverCluster`: interaction callbacks.

The component renders its own Canvas 2D map layer plus SVG labels/overlays. It does not require Tailwind or Catlas app CSS. Give the parent element an explicit height.

## Controlled Viewport

```tsx
import { useState } from "react";
import {
  SemanticAtlasMap,
  type AtlasViewportState,
} from "@catlas/atlas-react";

export function ControlledMap() {
  const [viewport, setViewport] = useState<AtlasViewportState>({
    centerX: 0,
    centerY: 0,
    zoom: 6.5,
  });

  return (
    <SemanticAtlasMap
      clusters={clusters}
      densityTiles={densityTiles}
      onViewportChange={setViewport}
      points={points}
      viewport={viewport}
    />
  );
}
```

See `examples/atlas-consumer` in the repository for a Vite app that imports only `@catlas/atlas-react`.

Build it from the repository root:

```bash
npm run build:packages
```
