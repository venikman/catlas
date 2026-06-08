# Catlas Monorepo

Private monorepo for the Semantic Atlas project: benchmark tooling, a reusable React map component, and a Postgres-backed example app.

```
packages/
  ui-graph-evaluator/   # Deliverable 1A — generic graph UI CLI
  atlas-benchmarks/     # Deliverable 1B — atlas API/render/clickable suite
  atlas-react/          # Deliverable 2 — SemanticAtlasMap component
apps/
  semantic-atlas/       # Deliverable 3 — full Next.js example
examples/
  atlas-consumer/       # minimal Vite proof host
```

## Deliverable 1 — Benchmark tooling

### 1A: `@catlas/ui-graph-evaluator`

Portable CLI for any canvas/SVG graph UI.

```bash
npm install
npm run build -w @catlas/ui-graph-evaluator
npx ui-graph-evaluator --url=http://127.0.0.1:4173 --gate
```

Artifacts default to `outputs/ui-evaluator/` when `--artifacts` is set. See [`packages/ui-graph-evaluator/README.md`](packages/ui-graph-evaluator/README.md).

### 1B: `@catlas/atlas-benchmarks`

Atlas-specific API, LOD, render, and clickable audit gates.

```bash
npm run build -w @catlas/atlas-benchmarks
npx atlas-benchmark --profile quick --gate --url=http://localhost:3002
npx atlas-clickable-audit --gate --url=http://localhost:3002
```

Optional `--start-server` boots `@catlas/semantic-atlas` for local runs. Reports: `outputs/atlas-benchmarks/`.

Root wrappers:

```bash
npm run bench:ui
npm run bench:atlas:quick
npm run bench:atlas:clickable
```

## Deliverable 2 — `@catlas/atlas-react`

Reusable map renderer with backend integration docs.

```bash
npm run build -w @catlas/atlas-react
```

```ts
import { SemanticAtlasMap, bboxForViewport } from "@catlas/atlas-react";
```

Backend contract, schema, API routes, adapter pattern, and benchmark selectors: [`packages/atlas-react/docs/backend-integration.md`](packages/atlas-react/docs/backend-integration.md).

## Deliverable 3 — Example app

Step-by-step run guide: [`apps/semantic-atlas/README.md`](apps/semantic-atlas/README.md).

```bash
npm run build:packages
npm run dev -w @catlas/semantic-atlas
```

The example imports the map only via `@catlas/atlas-react`; fetching and API routes stay in the app.

## Workspace validation

```bash
npm install
npm run validate
```

Individual targets:

```bash
npm run build:packages
npm test
npm run typecheck
npm run example:atlas-consumer:build
```

## Visual reference (map surface only)

The Nomic comparison target is the map/graph only — not header, search, or sidebar chrome. See [`docs/atlas-visual-system.md`](docs/atlas-visual-system.md).

```bash
npx ui-graph-evaluator \
  --url=http://localhost:3002 \
  --graph-selector='[data-testid="atlas-canvas"]' \
  --overlay-selector='[data-atlas-kind="density-label"]' \
  --interaction=wheel-pan \
  --reference-image=/absolute/path/to/nomic-twitter-map-only.png \
  --strict-reference \
  --gate
```

## Production notes

[`docs/atlas-production.md`](docs/atlas-production.md) — bounds, caching, indexes, and scale path.
