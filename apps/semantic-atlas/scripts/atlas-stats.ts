export {};

function arg(name: string, fallback?: string): string | undefined {
  const direct = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  if (direct) return direct.split("=").slice(1).join("=");
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const baseUrl = (arg("base", process.env.ATLAS_BASE_URL) ?? "http://localhost:3002").replace(
  /\/$/,
  "",
);

async function run() {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/api/atlas/views`);
  const text = await response.text();
  const ms = Number((performance.now() - startedAt).toFixed(2));
  if (!response.ok) {
    throw new Error(`stats failed with ${response.status}: ${text}`);
  }

  const body = JSON.parse(text) as {
    count?: number;
    serverTimingMs?: number;
    stats?: { entityCount: number; pointRows: number; source: string };
  };

  console.table([
    {
      endpointMs: ms,
      entityCount: body.stats?.entityCount ?? 0,
      pointRows: body.stats?.pointRows ?? 0,
      serverTimingMs: body.serverTimingMs ?? "n/a",
      source: body.stats?.source ?? "unknown",
      views: body.count ?? 0,
    },
  ]);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
