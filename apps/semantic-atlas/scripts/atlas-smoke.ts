export {};

type JsonRecord = Record<string, unknown>;

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

async function fetchJson(path: string): Promise<{
  body: JsonRecord;
  bytes: number;
  ms: number;
  status: number;
}> {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  const ms = Number((performance.now() - startedAt).toFixed(2));
  const body = text ? (JSON.parse(text) as JsonRecord) : {};
  return {
    body,
    bytes: Buffer.byteLength(text),
    ms,
    status: response.status,
  };
}

function assertOk(name: string, result: { body: JsonRecord; status: number }) {
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`${name} failed with ${result.status}: ${JSON.stringify(result.body)}`);
  }
}

function endpoint(path: string, params: Record<string, string | number>) {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return `${url.pathname}${url.search}`;
}

async function run() {
  const smoke: Array<{ bytes: number; count: unknown; endpoint: string; ms: number }> = [];

  const views = await fetchJson("/api/atlas/views");
  assertOk("views", views);
  smoke.push({
    bytes: views.bytes,
    count: views.body.count,
    endpoint: "views",
    ms: views.ms,
  });

  const density = await fetchJson(
    endpoint("/api/atlas/density", {
      view: "research-domains",
      zoom: 1.2,
      minX: -7,
      maxX: 7,
      minY: -5,
      maxY: 5,
    }),
  );
  assertOk("density", density);
  smoke.push({
    bytes: density.bytes,
    count: density.body.count,
    endpoint: "density",
    ms: density.ms,
  });

  const clusters = await fetchJson(
    endpoint("/api/atlas/clusters", {
      view: "research-domains",
      zoom: 4.2,
      minX: -3,
      maxX: 4,
      minY: -3,
      maxY: 3,
    }),
  );
  assertOk("clusters", clusters);
  smoke.push({
    bytes: clusters.bytes,
    count: clusters.body.count,
    endpoint: "clusters",
    ms: clusters.ms,
  });

  const points = await fetchJson(
    endpoint("/api/atlas/points", {
      view: "research-domains",
      zoom: 7.2,
      minX: -0.6,
      maxX: 0.8,
      minY: -0.6,
      maxY: 0.8,
      limit: 250,
    }),
  );
  assertOk("points", points);
  smoke.push({
    bytes: points.bytes,
    count: points.body.count,
    endpoint: "points",
    ms: points.ms,
  });

  const search = await fetchJson(
    endpoint("/api/atlas/search", {
      view: "research-domains",
      q: "graph",
      limit: 5,
    }),
  );
  assertOk("search", search);
  smoke.push({
    bytes: search.bytes,
    count: search.body.count,
    endpoint: "search",
    ms: search.ms,
  });

  const firstEntity = ((search.body.results as Array<{ entityId?: string }> | undefined) ?? [])
    .find((result) => result.entityId)?.entityId;
  if (!firstEntity) {
    throw new Error("search did not return an entity id for entity smoke test.");
  }

  const entity = await fetchJson(`/api/atlas/entity/${encodeURIComponent(firstEntity)}`);
  assertOk("entity", entity);
  smoke.push({
    bytes: entity.bytes,
    count: entity.body.count,
    endpoint: "entity",
    ms: entity.ms,
  });

  console.table(smoke);
  console.log(`Smoke passed for ${baseUrl}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
