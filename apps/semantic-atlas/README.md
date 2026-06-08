# Semantic Atlas example app

Full Next.js + Postgres reference integration for `@catlas/atlas-react`. Follow this guide to run the example, then adapt using [`packages/atlas-react/docs/backend-integration.md`](../../packages/atlas-react/docs/backend-integration.md).

## 1. Install dependencies

From the monorepo root:

```bash
npm install
npm run build:packages
```

## 2. Start Postgres

```bash
cd apps/semantic-atlas
docker compose -f docker-compose.postgres.yml up -d
export DATABASE_URL=postgres://atlas:atlas@localhost:54322/atlas_bench
```

## 3. Migrate and seed

```bash
npm run db:migrate
npm run seed:atlas -- --count 42500 --reset --yes
```

Optional stats check:

```bash
npm run atlas:db:stats
```

## 4. Run the app

From monorepo root:

```bash
npm run dev -w @catlas/semantic-atlas
```

Open [http://localhost:3002](http://localhost:3002).

Without `DATABASE_URL`, development falls back to in-memory demo data.

## 5. Run benchmark gates

With the app running:

```bash
# From monorepo root
npm run bench:atlas:quick -- --gate --url=http://localhost:3002
npm run bench:atlas:clickable -- --gate --url=http://localhost:3002
npm run bench:ui -- \
  --url=http://localhost:3002 \
  --root-selector='[data-testid="atlas-root"]' \
  --graph-selector='[data-testid="atlas-canvas"]' \
  --overlay-selector='[data-atlas-kind="density-label"]' \
  --interaction=wheel-pan \
  --gate
```

Reports are written under `outputs/atlas-benchmarks/` (gitignored).

## 6. How this app uses the package

- **Map rendering:** `components/atlas/AtlasViewer.tsx` imports `SemanticAtlasMap` from `@catlas/atlas-react`.
- **Data fetching:** TanStack Query + `lib/atlas/api.ts` call `/api/atlas/*` routes.
- **Server/DB:** `app/api/atlas/*` and `lib/atlas/db.ts` — not part of the component package.

Copy the adapter pattern from `AtlasViewer`, not the app chrome (header, sidebar, search shell), when adopting in another project.

## Minimal consumer proof

```bash
npm run example:atlas-consumer:build
npm run example:atlas-consumer:preview
npm run bench:ui -- --url=http://127.0.0.1:4173 --gate
```

See `examples/atlas-consumer/README.md` for the smallest Vite host.
