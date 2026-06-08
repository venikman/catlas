export {};

type LoadResult = {
  bytes: number;
  count: number;
  endpoint: string;
  ms: number;
  status: number;
};

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
const iterations = Number.parseInt(arg("iterations", "45") ?? "45", 10);

function endpoint(path: string, params: Record<string, string | number>) {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return `${url.pathname}${url.search}`;
}

function percentile(values: number[], pct: number): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((pct / 100) * sorted.length) - 1);
  return Number(sorted[index].toFixed(2));
}

async function hit(endpointPath: string): Promise<LoadResult> {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${endpointPath}`);
  const text = await response.text();
  const ms = Number((performance.now() - startedAt).toFixed(2));
  let count = 0;
  try {
    const body = JSON.parse(text) as { count?: number };
    count = Number(body.count ?? 0);
  } catch {
    count = 0;
  }
  return {
    bytes: Buffer.byteLength(text),
    count,
    endpoint: endpointPath.split("?")[0],
    ms,
    status: response.status,
  };
}

async function run() {
  const paths = Array.from({ length: iterations }, (_, index) => {
    const phase = index % 3;
    const offset = (index % 9) * 0.18;
    if (phase === 0) {
      return endpoint("/api/atlas/density", {
        view: "research-domains",
        zoom: 1.4,
        minX: -7 + offset,
        maxX: 7 + offset,
        minY: -5,
        maxY: 5,
      });
    }
    if (phase === 1) {
      return endpoint("/api/atlas/clusters", {
        view: "research-domains",
        zoom: 4.2,
        minX: -3 + offset,
        maxX: 4 + offset,
        minY: -3,
        maxY: 3,
      });
    }
    return endpoint("/api/atlas/points", {
      view: "research-domains",
      zoom: 7.2,
      minX: -0.8 + offset,
      maxX: 0.8 + offset,
      minY: -0.8,
      maxY: 0.8,
      limit: 500,
    });
  });

  const results: LoadResult[] = [];
  for (const path of paths) {
    results.push(await hit(path));
  }

  const byEndpoint = new Map<string, LoadResult[]>();
  for (const result of results) {
    const bucket = byEndpoint.get(result.endpoint) ?? [];
    bucket.push(result);
    byEndpoint.set(result.endpoint, bucket);
  }

  const summary = Array.from(byEndpoint, ([endpointName, bucket]) => {
    const timings = bucket.map((result) => result.ms);
    return {
      avgBytes: Math.round(
        bucket.reduce((sum, result) => sum + result.bytes, 0) / bucket.length,
      ),
      avgRows: Math.round(
        bucket.reduce((sum, result) => sum + result.count, 0) / bucket.length,
      ),
      endpoint: endpointName,
      failures: bucket.filter((result) => result.status >= 400).length,
      p50: percentile(timings, 50),
      p95: percentile(timings, 95),
      p99: percentile(timings, 99),
      requests: bucket.length,
    };
  });

  console.table(summary);
  if (summary.some((row) => row.failures > 0)) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
