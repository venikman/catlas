# Atlas Consumer Fixture

Minimal Vite app that consumes the map renderer through `@catlas/atlas-react`.

This fixture is intentionally outside the Next.js example app. It proves the atlas component can be adopted by another React project without importing Catlas app code, API routes, database code, search UI, side panels, or benchmark internals.

From the repository root:

```bash
npm run example:atlas-consumer:build
npm run example:atlas-consumer:preview
```

Then evaluate it:

```bash
npx ui-graph-evaluator \
  --url=http://127.0.0.1:4173 \
  --root-selector='[data-testid="consumer-root"]' \
  --graph-selector='[data-testid="semantic-atlas-map"]' \
  --overlay-selector='[data-atlas-kind="density-label"]' \
  --interaction=wheel-pan \
  --gate
```
