---
name: catlas-adoption-scout
description: >-
  Read-only scout for adopting @catlas/atlas-react. Inspects an adopter repo and
  reports its framework, data access, graph surface, styling system, and data
  source, then recommends the first realistic maturity target (M1, M1.5, or M2)
  and the next skill to run. Use this first, before any edits, when a team wants
  to evaluate whether their product can render as a Catlas semantic atlas.
---

# catlas-adoption-scout

Explore an adopter repository read-only and produce an adoption assessment. This
skill never edits code. Its job is to tell the team where they realistically
start on the maturity ladder and which skill to run next.

The maturity ladder, decisions (D1 access control is upstream, D2 data access is
modular via the `AtlasStore` interface, D3 HTTP serving is a recommendation), and
finding-ID review policy are canonical in
[`docs/atlas-adoption-maturity-plan.md`](../../../docs/atlas-adoption-maturity-plan.md)
and [`docs/adoption/CONTRACT.md`](../../../docs/adoption/CONTRACT.md). Read those
before reporting a maturity target.

## Preconditions

- The adopter repo path is known and can be inspected read-only.
- The package manager is known or discoverable (lockfile present).
- Dependencies can be listed without installing or running build steps.

## Allowed edits (path globs)

- **None.** Scout mode is strictly read-only. Do not modify any file. If the team
  wants edits, hand off to `catlas-benchmark-gate` or a hybrid skill.

## Prohibited actions

- Never commit `.env`, generated production data, database dumps, or credentials.
- Never run destructive SQL such as `DROP TABLE`, `DELETE`, or `TRUNCATE`.
- Never connect to or read from an active production database; read schema/config
  files, not live data.
- Never edit files — this is a read-only assessment.
- Never claim M2 or higher without source-data evidence (a coordinate recipe that
  passes `npm run conformance` plus an `AtlasStore` implementation). Absent that
  evidence, cap the recommendation at M1 or M1.5.

## Stop conditions

- Stop and report "no graph surface found" if no React app, canvas/SVG graph
  surface, or route candidate is found after scanning **3** route candidates.
- Stop if the repo has no `package.json` / lockfile and the package manager
  cannot be determined.
- Stop immediately if a requested inspection would require running build,
  install, or a live DB connection.

## What to report

1. Package manager and Node/React versions.
2. App framework and the route(s) that host (or could host) a graph surface.
3. Likely graph selectors already present, mapped to `ATLAS_SELECTORS`
   (`[data-testid="semantic-atlas-map"]`, `[data-testid="atlas-canvas"]`,
   `[data-atlas-kind="density-label"]`).
4. Styling system (tokens, CSS framework, theme files) for later M3 work.
5. Data source (Postgres / other DB / API / files) and whether an `AtlasStore`
   implementation is feasible (D2).
6. Recommended first maturity target with the evidence it would require, and the
   next skill to run (usually `catlas-benchmark-gate`).

## Copy-paste validation commands

Run these from the Catlas repository root to confirm the baseline an adopter
inherits before scouting their repo (all are real root scripts):

```bash
# Confirm package adoption baseline (M1) builds and the consumer renders.
npm run build:packages
npm run example:atlas-consumer:build
```

```bash
# Confirm the existing M2 mapping the adopter will target works end to end.
npm run conformance
```

Report the scout's findings as text. Do not write generated assessment files into
the adopter repo unless the team explicitly asks for one.
