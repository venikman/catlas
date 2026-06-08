## Learned User Preferences

- Validate in the browser or runtime yourself before telling the user something works or asking them to try it.
- Prefer one private monorepo with three workspace packages over three separate GitHub repos.
- Do not edit attached plan files when implementing a plan; execute against them without modifying the plan artifact.
- When splitting work into PRs, propose reviewer-aligned slices first and wait for approval before creating branches, commits, pushes, or PRs.
- Stage only named files or hunks per PR slice; do not use `git add .` or `git add -A`.
- Use the `cursor/` branch name prefix for feature branches.
- Do not recreate todos that already exist when executing a plan with pre-created todos.

## Workspace Facts

- This repository (`venikman/catlas`) is the single source of truth — an npm workspaces monorepo (`packages/*`, `apps/*`, `examples/*`) named `catlas-monorepo`. (Consolidated 2026-06-08 from a former wrapper repo that embedded catlas as a submodule under `work/catlas`.)
- Three deliverables: `@catlas/ui-graph-evaluator` and `@catlas/atlas-benchmarks` (benchmark tools), `@catlas/atlas-react` (reusable renderer), and `@catlas/semantic-atlas` (Next.js example app on port 3002).
- The semantic-atlas app uses the OntoTwin Atlas design system (tokens, kit CSS, shell layout).
- `examples/atlas-consumer` is a Vite fixture proving external adoption of `@catlas/atlas-react`.
- Root validation scripts include `validate`, `validate:example`, `bench:ui`, and `bench:atlas:*`.
