import { ATLAS_CONTRACT_VERSION } from "@catlas/atlas-react/contract";
import { ATLAS_RUNTIME_CONFIG, cacheHeader } from "./runtimeConfig";

export type AtlasRouteTimer = {
  mark: (name: string, startedAt: number) => void;
  measure: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
  meta: () => {
    serverTimingMs: number;
    timings: Record<string, number>;
    contractVersion: typeof ATLAS_CONTRACT_VERSION;
  };
  responseHeaders: (ttlSeconds?: number) => Headers;
};

function nowMs(): number {
  return performance.now();
}

export function createAtlasRouteTimer(route: string): AtlasRouteTimer {
  const startedAt = nowMs();
  const timings = new Map<string, number>();

  function durationSince(start: number): number {
    return Number((nowMs() - start).toFixed(2));
  }

  return {
    mark(name, start) {
      timings.set(name, durationSince(start));
    },
    async measure(name, fn) {
      const sectionStartedAt = nowMs();
      try {
        return await fn();
      } finally {
        timings.set(name, durationSince(sectionStartedAt));
      }
    },
    meta() {
      return {
        serverTimingMs: durationSince(startedAt),
        timings: Object.fromEntries(timings),
        contractVersion: ATLAS_CONTRACT_VERSION,
      };
    },
    responseHeaders(ttlSeconds) {
      const headers = new Headers();
      if (ttlSeconds !== undefined) {
        headers.set("Cache-Control", cacheHeader(ttlSeconds));
      }

      if (ATLAS_RUNTIME_CONFIG.enableServerTiming) {
        const entries = [
          ...Array.from(timings, ([name, duration]) => `${name};dur=${duration}`),
          `${route};dur=${durationSince(startedAt)}`,
        ];
        headers.set("Server-Timing", entries.join(", "));
      }

      return headers;
    },
  };
}

export function atlasJson<T>(
  body: T,
  input: {
    status?: number;
    timer: AtlasRouteTimer;
    ttlSeconds?: number;
  },
): Response {
  return Response.json(body, {
    status: input.status ?? 200,
    headers: input.timer.responseHeaders(input.ttlSeconds),
  });
}

export function atlasError(
  error: string,
  input: {
    code?: string;
    status?: number;
    timer: AtlasRouteTimer;
    ttlSeconds?: number;
  },
): Response {
  const status = input.status ?? 400;
  return atlasJson(
    {
      error,
      code: input.code ?? "ATLAS_REQUEST_ERROR",
      ok: false,
      status,
      ...input.timer.meta(),
    },
    {
      status,
      timer: input.timer,
      ttlSeconds: input.ttlSeconds,
    },
  );
}

export function logAtlasRequest(input: {
  bbox?: unknown;
  count?: number;
  limit?: number;
  route: string;
  timer: AtlasRouteTimer;
  view?: string;
}): void {
  if (!ATLAS_RUNTIME_CONFIG.debug) return;
  const meta = input.timer.meta();
  console.info("[atlas]", {
    bbox: input.bbox,
    count: input.count,
    limit: input.limit,
    route: input.route,
    serverTimingMs: meta.serverTimingMs,
    timings: meta.timings,
    view: input.view,
  });
}
