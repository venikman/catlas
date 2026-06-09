# Atlas data-prep recipe

Plain JavaScript conformance fixture for `@catlas/atlas-react/contract`.

The recipe turns embedding rows into atlas-ready coordinates:

1. Center embedding vectors.
2. Project them to two dimensions with a dependency-free PCA fallback.
3. Normalize coordinates into `worldBounds`.
4. Build clusters and density tiles with the shared contract helpers.
5. Validate points, clusters, and tiles with the runtime contract validator.

Run from the repository root:

```bash
npm run conformance -w examples/atlas-data-prep
```

The root command `npm run conformance` also packs `@catlas/atlas-react` and
imports `@catlas/atlas-react/contract` from a temporary consumer outside the
monorepo.
