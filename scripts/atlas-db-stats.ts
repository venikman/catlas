import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for atlas:db:stats.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

async function scalar<T = string>(sql: string): Promise<T | null> {
  const result = await pool.query(sql);
  return (result.rows[0]?.value as T | undefined) ?? null;
}

async function run() {
  const [
    views,
    pointRows,
    entities,
    clusters,
    densityTiles,
    postgis,
    totalSize,
  ] = await Promise.all([
    scalar<number>("select count(*)::int as value from atlas_views"),
    scalar<number>("select count(*)::int as value from atlas_points"),
    scalar<number>("select count(distinct entity_id)::int as value from atlas_points"),
    scalar<number>("select count(*)::int as value from atlas_clusters"),
    scalar<number>("select count(*)::int as value from atlas_density_tiles"),
    scalar<string>(
      "select extversion as value from pg_extension where extname = 'postgis'",
    ),
    scalar<string>(
      "select pg_size_pretty(pg_total_relation_size('atlas_points')) as value",
    ),
  ]);

  const indexRows = await pool.query<{
    indexname: string;
    tablename: string;
  }>(
    `
      select tablename, indexname
      from pg_indexes
      where schemaname = 'public'
        and tablename in (
          'atlas_views',
          'atlas_points',
          'atlas_clusters',
          'atlas_density_tiles'
        )
      order by tablename, indexname
    `,
  );

  console.table([
    {
      clusters,
      densityTiles,
      entities,
      pointRows,
      postgis: postgis ?? "not installed",
      totalPointTableSize: totalSize ?? "n/a",
      views,
    },
  ]);
  console.log("Indexes:");
  for (const row of indexRows.rows) {
    console.log(`- ${row.tablename}.${row.indexname}`);
  }
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
