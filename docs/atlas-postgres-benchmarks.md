# Atlas Postgres Benchmarks

This runbook enables live Postgres query benchmarking for the Semantic Atlas prototype. It is intentionally separate from visual polish and renderer work.

The benchmark gate still passes without `DATABASE_URL`; in that case live DB checks are reported as `SKIP`. Configure the local database below when you need measured query latency and EXPLAIN plan evidence.

## Local Database

Start the disposable local benchmark database:

```bash
docker compose -f docker-compose.postgres.yml up -d
```

Use the matching local URL:

```bash
export DATABASE_URL=postgres://atlas:atlas@localhost:54322/atlas_bench
```

Apply the baseline and hardened migrations:

```bash
npm run db:migrate
```

To include optional PostGIS geometry and GiST indexes:

```bash
npm run db:migrate -- --postgis
```

## Seed Synthetic Data

Seed a small local dataset:

```bash
npm run atlas:seed -- --count 10000 --reset --yes
```

`--count` is entity count. The current synthetic generator writes one point row
per entity per atlas view, so the current 4-view setup writes `count * 4` point
rows.

Seed the current-scale benchmark dataset of roughly 170k point rows:

```bash
npm run atlas:seed -- --count 42500 --reset --yes
```

Seed a larger 170k-entity stress dataset:

```bash
npm run atlas:seed -- --count 170000 --reset --yes
```

The seed script generates `.atlas-data/synthetic-atlas-<count>.jsonl` if it is missing. Generated atlas data is ignored by git.

Inspect database size and indexes:

```bash
npm run atlas:db:stats
```

## Run Live DB Benchmarks

Run only the DB validator:

```bash
npm run bench:atlas:db
```

Run the full quick gate with a configured database:

```bash
npm run validate:atlas
```

The live DB validator measures representative p95 timings for:

- views list and view lookup
- density bbox lookup
- cluster bbox lookup
- high-zoom bounded point lookup
- lazy entity metadata lookup
- bounded lightweight search

Latency misses are warnings unless they reveal an unsafe architecture. The validator fails hard for unbounded row counts, accidental heavy metadata in bulk point queries, or interactive `atlas_points` sequential scans once the database is seeded at the current-scale target.

## Query Plans

Run representative EXPLAIN ANALYZE statements:

```bash
npm run atlas:analyze-queries
```

The script reads:

```text
packages/atlas-benchmarks/src/sql/explain-atlas-queries.sql
```

Edit the `\set` values in that SQL file for the viewport, search term, or entity id under investigation.

## Safety Notes

- Do not commit `.env`, generated JSONL files, database dumps, or benchmark result artifacts.
- `--reset --yes` truncates atlas tables in the configured database; use it only against disposable local data.
- These commands do not import production data.
- `DATABASE_URL` absence means DB benchmark coverage is skipped, not failed.
