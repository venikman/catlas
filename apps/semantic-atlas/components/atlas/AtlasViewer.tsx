"use client";

import {
  SemanticAtlasMap,
  ATLAS_INITIAL_LAYERS,
  ATLAS_INITIAL_VIEWPORT,
  type AtlasViewportState,
  type LayerToggles,
} from "@catlas/atlas-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { fetchAtlasViews, fetchViewportData } from "@/lib/atlas/api";
import { ATLAS_CLIENT_CACHE, viewportCachePolicy } from "@/lib/atlas/cachePolicy";
import { formatAtlasCount } from "@/lib/atlas/format";
import { getLodForZoom, zoomBandForZoom } from "@/lib/atlas/lod";
import { expandBbox } from "@/lib/atlas/math";
import { atlasQueryKeys } from "@/lib/atlas/queryKeys";
import {
  ATLAS_VISUAL_CONFIG,
  atlasZoomToDisplayZoom,
  clampAtlasZoom,
} from "@/lib/atlas/visualConfig";
import type {
  AtlasBbox,
  AtlasCluster,
  AtlasDensityTile,
  AtlasPoint,
  AtlasSearchResult,
  AtlasView,
} from "@/lib/atlas/types";
import { AtlasControls } from "./AtlasControls";
import { AtlasDebugPanel } from "./AtlasDebugPanel";
import { AtlasLodControls } from "./AtlasLodControls";
import { AtlasSearch } from "./AtlasSearch";
import { AtlasSidePanel } from "./AtlasSidePanel";

const DEBUG_PANEL_ENABLED = process.env.NEXT_PUBLIC_ATLAS_DEBUG === "true";

type AtlasTargetMarker = {
  id: string;
  label?: string;
  x: number;
  y: number;
};

const FALLBACK_VIEWS: AtlasView[] = [
  {
    id: "view-research-domains",
    slug: "research-domains",
    name: "Research Domains",
    description: "Topic-space projection grouped by research domain.",
  },
  {
    id: "view-topics",
    slug: "topics",
    name: "Topics",
    description: "Finer topical projection from labels and abstracts.",
  },
  {
    id: "view-document-types",
    slug: "document-types",
    name: "Document Types",
    description: "Projection organized by publication and document type.",
  },
  {
    id: "view-languages",
    slug: "languages",
    name: "Languages",
    description: "Projection grouped by language and corpus source.",
  },
];

function computeBbox(viewport: AtlasViewportState): AtlasBbox {
  const spanX = 15 / Math.pow(1.32, viewport.zoom);
  const spanY = spanX * 0.72;
  return {
    minX: Number((viewport.centerX - spanX / 2).toFixed(4)),
    maxX: Number((viewport.centerX + spanX / 2).toFixed(4)),
    minY: Number((viewport.centerY - spanY / 2).toFixed(4)),
    maxY: Number((viewport.centerY + spanY / 2).toFixed(4)),
  };
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debounced;
}

function useFrameStats(): { frameMs: number; fps: number } {
  const [stats, setStats] = useState({ frameMs: 16.7, fps: 60 });

  useEffect(() => {
    let previous = performance.now();
    let frame = 0;
    let raf = 0;

    const tick = (now: number) => {
      frame += 1;
      const frameMs = now - previous;
      previous = now;
      if (frame % 18 === 0) {
        setStats({
          frameMs: Number(frameMs.toFixed(1)),
          fps: Number((1000 / Math.max(frameMs, 1)).toFixed(1)),
        });
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return stats;
}

function extractPoints(data: unknown): AtlasPoint[] {
  if (!data || typeof data !== "object") return [];
  const record = data as {
    points?: AtlasPoint[];
    representativePoints?: AtlasPoint[];
  };
  return record.points ?? record.representativePoints ?? [];
}

function extractClusters(data: unknown): AtlasCluster[] {
  if (!data || typeof data !== "object") return [];
  return ((data as { clusters?: AtlasCluster[] }).clusters ?? []) as AtlasCluster[];
}

function extractDensityTiles(data: unknown): AtlasDensityTile[] {
  if (!data || typeof data !== "object") return [];
  return ((data as { tiles?: AtlasDensityTile[] }).tiles ?? []) as AtlasDensityTile[];
}

function statusCopy(
  selectedEntityId: string | null,
  featuredCluster: AtlasCluster | null,
  isFetching: boolean,
): string {
  if (isFetching) return "Loading viewport…";
  if (selectedEntityId) return `${selectedEntityId} selected`;
  if (featuredCluster) return `${featuredCluster.clusterId} selected`;
  return "Ready";
}

function AtlasViewerInner() {
  const [selectedView, setSelectedView] = useState("research-domains");
  const [viewport, setViewport] = useState<AtlasViewportState>(ATLAS_INITIAL_VIEWPORT);
  const [layers, setLayers] = useState<LayerToggles>(ATLAS_INITIAL_LAYERS);
  const [hoveredPoint, setHoveredPoint] = useState<AtlasPoint | null>(null);
  const [hoveredCluster, setHoveredCluster] = useState<AtlasCluster | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [densityContextTiles, setDensityContextTiles] = useState<AtlasDensityTile[]>([]);
  const [clusterContext, setClusterContext] = useState<AtlasCluster[]>([]);
  const [pointContext, setPointContext] = useState<AtlasPoint[]>([]);
  const [targetMarker, setTargetMarker] = useState<AtlasTargetMarker | null>(null);
  const [requestCount, setRequestCount] = useState(0);
  const [clusterInspectorDismissed, setClusterInspectorDismissed] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const frameStats = useFrameStats();

  const viewsQuery = useQuery({
    queryKey: atlasQueryKeys.views(),
    queryFn: ({ signal }) => fetchAtlasViews(signal),
    staleTime: ATLAS_CLIENT_CACHE.views.staleTime,
    gcTime: ATLAS_CLIENT_CACHE.views.gcTime,
  });

  const views = viewsQuery.data?.views ?? FALLBACK_VIEWS;
  const stats = viewsQuery.data?.stats;
  const lod = getLodForZoom(viewport.zoom);
  const bbox = useMemo(() => computeBbox(viewport), [viewport]);
  const debouncedViewport = useDebouncedValue(
    { bbox, zoom: viewport.zoom },
    ATLAS_VISUAL_CONFIG.zoom.debounceMs,
  );
  const fetchBbox = useMemo(
    () => expandBbox(debouncedViewport.bbox, ATLAS_VISUAL_CONFIG.zoom.fetchPadding),
    [debouncedViewport.bbox],
  );

  const viewportQuery = useQuery({
    queryKey: atlasQueryKeys.viewport({
      view: selectedView,
      lod: lod.layer,
      zoomBand: zoomBandForZoom(debouncedViewport.zoom),
      bbox: fetchBbox,
    }),
    queryFn: ({ signal }) =>
      fetchViewportData({
        view: selectedView,
        zoom: debouncedViewport.zoom,
        bbox: fetchBbox,
        signal,
      }),
    placeholderData: keepPreviousData,
    ...viewportCachePolicy(lod.layer),
  });

  const densityTiles = extractDensityTiles(viewportQuery.data);
  const clusters = extractClusters(viewportQuery.data);
  const points = extractPoints(viewportQuery.data);
  const canvasDensityTiles =
    densityTiles.length > 0 ? densityTiles : densityContextTiles;
  const canvasClusters =
    clusters.length > 0 || lod.layer !== "points" ? clusters : clusterContext;
  const canvasPoints =
    points.length > 0 || lod.layer !== "points" ? points : pointContext;
  const clientRequestMs =
    viewportQuery.data && "clientRequestMs" in viewportQuery.data
      ? Number(viewportQuery.data.clientRequestMs)
      : null;
  const serverTimingMs =
    viewportQuery.data && "serverTimingMs" in viewportQuery.data
      ? Number(viewportQuery.data.serverTimingMs)
      : null;
  const truncated =
    viewportQuery.data && "truncated" in viewportQuery.data
      ? Boolean(viewportQuery.data.truncated)
      : false;
  const featuredCluster =
    clusterInspectorDismissed || !selectedClusterId
      ? null
      : canvasClusters.find((cluster) => cluster.clusterId === selectedClusterId) ?? null;

  useEffect(() => {
    if (viewportQuery.data) {
      setRequestCount((current) => current + 1);
    }
  }, [viewportQuery.data]);

  useEffect(() => {
    if (densityTiles.length > 0) {
      setDensityContextTiles(densityTiles);
    }
  }, [densityTiles]);

  useEffect(() => {
    if (clusters.length > 0) {
      setClusterContext(clusters);
    }
  }, [clusters]);

  useEffect(() => {
    if (points.length > 0) {
      setPointContext(points);
    }
  }, [points]);

  function showTargetMarker(marker: AtlasTargetMarker) {
    setTargetMarker(marker);
    window.setTimeout(() => {
      setTargetMarker((current) => (current?.id === marker.id ? null : current));
    }, ATLAS_VISUAL_CONFIG.animation.targetMarkerMs);
  }

  function handleSelectView(nextView: string) {
    setSelectedView(nextView);
    setDensityContextTiles([]);
    setClusterContext([]);
    setPointContext([]);
    setClusterInspectorDismissed(false);
    setSelectedClusterId(null);
    setLayers((current) => ({
      ...current,
      density: true,
      clusters: true,
      labels: true,
    }));
  }

  function handleSearchResult(result: AtlasSearchResult) {
    const marker = {
      id: `search-${result.entityId}-${Date.now()}`,
      label: result.label,
      x: result.x,
      y: result.y,
    };
    showTargetMarker(marker);
    setViewport({
      centerX: result.x,
      centerY: result.y,
      zoom: Math.max(viewport.zoom, ATLAS_VISUAL_CONFIG.zoom.flyToZoom),
    });
    setSelectedEntityId(result.entityId);
    setSelectedClusterId(result.clusterId);
    setClusterInspectorDismissed(false);
    setRailCollapsed(false);
  }

  function handleSelectCluster(cluster: AtlasCluster) {
    const marker = {
      id: `cluster-${cluster.clusterId}-${Date.now()}`,
      label: cluster.label,
      x: cluster.centroidX,
      y: cluster.centroidY,
    };
    showTargetMarker(marker);
    setSelectedEntityId(null);
    setSelectedClusterId(cluster.clusterId);
    setClusterInspectorDismissed(false);
    setRailCollapsed(false);
    setViewport((current) => ({
      ...current,
      centerX: cluster.centroidX,
      centerY: cluster.centroidY,
      zoom: clampAtlasZoom(
        Math.max(
          current.zoom + 1.1,
          ATLAS_VISUAL_CONFIG.zoom.clusterClickZoom,
        ),
      ),
    }));
  }

  function handleZoomStep(delta: number) {
    setViewport((current) => ({
      ...current,
      zoom: clampAtlasZoom(current.zoom + delta),
    }));
  }

  function handleClearSelection() {
    setSelectedEntityId(null);
    setSelectedClusterId(null);
    setClusterInspectorDismissed(true);
  }

  const representedCount = stats?.pointRows ?? points.length;
  const status = statusCopy(
    selectedEntityId,
    featuredCluster,
    viewportQuery.isFetching,
  );

  return (
    <main
      className={`ontotwin-atlas overflow-hidden ${railCollapsed ? "rail-collapsed" : ""}`}
      data-testid="atlas-root"
    >
      <section className="ontotwin-map-layer">
        <SemanticAtlasMap
          style={{ height: "100%", minHeight: "100%" }}
          bbox={bbox}
          clusters={canvasClusters}
          densityTiles={canvasDensityTiles}
          hoveredEntityId={hoveredPoint?.entityId ?? null}
          layers={layers}
          lod={lod.layer}
          onHoverCluster={setHoveredCluster}
          onHoverPoint={setHoveredPoint}
          onSelectCluster={handleSelectCluster}
          onSelectPoint={(point) => {
            setSelectedEntityId(point.entityId);
            setSelectedClusterId(point.clusterId);
            setClusterInspectorDismissed(false);
            setRailCollapsed(false);
          }}
          onViewportChange={setViewport}
          points={canvasPoints}
          selectedEntityId={selectedEntityId}
          targetMarker={targetMarker}
          viewport={viewport}
        />

        <AtlasSearch
          corpusCount={stats?.pointRows ?? null}
          selectedView={selectedView}
          status={status}
          onResultSelect={handleSearchResult}
        />

        <AtlasControls
          zoom={viewport.zoom}
          onFit={() => setViewport(ATLAS_INITIAL_VIEWPORT)}
          onZoomStep={handleZoomStep}
        />

        <AtlasLodControls
          active={lod.layer}
          onZoomChange={(zoom) =>
            setViewport((current) => ({
              ...current,
              zoom: clampAtlasZoom(zoom),
            }))
          }
        />

        <div className="status-pill" aria-live="polite">
          <strong suppressHydrationWarning>{status}</strong>
          <span suppressHydrationWarning>
            {formatAtlasCount(representedCount)} represented docs
          </span>
        </div>

        {DEBUG_PANEL_ENABLED ? (
          <div className="pointer-events-auto absolute left-[18px] top-[220px] z-30 hidden sm:block">
            <AtlasDebugPanel
              activeView={selectedView}
              animationActive={Boolean(targetMarker)}
              bbox={bbox}
              clusterCount={clusters.length}
              densityTileCount={densityTiles.length}
              fetchedPointCount={points.length}
              frameMs={frameStats.frameMs}
              fps={frameStats.fps}
              isFetching={viewportQuery.isFetching}
              lastRequestMs={clientRequestMs}
              lod={lod.layer}
              pointCount={points.length}
              requestCount={requestCount}
              serverTimingMs={serverTimingMs}
              source={stats?.source ?? "unknown"}
              truncated={truncated}
              zoom={viewport.zoom}
            />
          </div>
        ) : null}

        {hoveredPoint ? (
          <div
            className="tooltip"
            style={{
              left: "min(52%, calc(100vw - 300px))",
              top: "47%",
            }}
          >
            <strong>{hoveredPoint.label}</strong>
            <span>{hoveredPoint.entityType}</span>
            <em>
              {hoveredPoint.clusterId} · zoom {atlasZoomToDisplayZoom(viewport.zoom).toFixed(1)}x
            </em>
          </div>
        ) : hoveredCluster ? (
          <div
            className="tooltip"
            style={{
              left: "min(52%, calc(100vw - 300px))",
              top: "47%",
            }}
          >
            <strong>{hoveredCluster.label}</strong>
            <span>{hoveredCluster.clusterId}</span>
            <em>{formatAtlasCount(hoveredCluster.pointCount)} represented docs</em>
          </div>
        ) : null}
      </section>

      {railCollapsed ? (
        <button
          type="button"
          className="sidecar-reopen"
          onClick={() => setRailCollapsed(false)}
        >
          Open rail
        </button>
      ) : (
        <AtlasSidePanel
          cluster={featuredCluster}
          entityId={selectedEntityId}
          layers={layers}
          selectedView={selectedView}
          views={views}
          onClearSelection={handleClearSelection}
          onCloseRail={() => setRailCollapsed(true)}
          onLayerToggle={(key) =>
            setLayers((current) => ({
              ...current,
              [key]: !current[key],
            }))
          }
          onSelectView={handleSelectView}
        />
      )}
    </main>
  );
}

export function AtlasViewer() {
  return (
    <QueryProvider>
      <AtlasViewerInner />
    </QueryProvider>
  );
}
