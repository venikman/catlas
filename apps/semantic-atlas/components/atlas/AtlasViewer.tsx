"use client";

import {
  SemanticAtlasMap,
  ATLAS_INITIAL_LAYERS,
  ATLAS_INITIAL_VIEWPORT,
  type AtlasViewportState,
  type LayerToggles,
} from "@catlas/atlas-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Activity,
  BookOpen,
  FileText,
  Globe2,
  Grid2X2,
  HelpCircle,
  Keyboard,
  Languages,
  Layers3,
  ListFilter,
  Settings,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { fetchAtlasViews, fetchViewportData } from "@/lib/atlas/api";
import { ATLAS_CLIENT_CACHE, viewportCachePolicy } from "@/lib/atlas/cachePolicy";
import { getLodForZoom, zoomBandForZoom } from "@/lib/atlas/lod";
import { expandBbox } from "@/lib/atlas/math";
import { atlasQueryKeys } from "@/lib/atlas/queryKeys";
import {
  ATLAS_VISUAL_CONFIG,
  atlasZoomToDisplayZoom,
  displayZoomToAtlasZoom,
  clampAtlasZoom,
} from "@/lib/atlas/visualConfig";
import type {
  AtlasBbox,
  AtlasCluster,
  AtlasDensityTile,
  AtlasLodLayer,
  AtlasPoint,
  AtlasSearchResult,
  AtlasView,
} from "@/lib/atlas/types";
import { AtlasControls } from "./AtlasControls";
import { AtlasDebugPanel } from "./AtlasDebugPanel";
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
  const inspectorOpen = Boolean(selectedEntityId || featuredCluster);

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

  return (
    <main
      className="relative h-screen w-screen overflow-hidden bg-[#efefec]"
      data-testid="atlas-root"
    >
      <aside className="hidden">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-full border border-slate-300 bg-white">
            <Activity size={17} />
          </div>
          <div className="hidden text-[15px] font-semibold tracking-normal text-slate-950 sm:block">
            Semantic Atlas
          </div>
        </div>

        <div className="mt-8 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:mt-9 sm:text-[10px] sm:tracking-[0.16em]">
          Views
        </div>
        <nav className="mt-3 space-y-1">
          <ViewButton
            active={selectedView === "research-domains"}
            icon={<Globe2 size={16} />}
            label="All Views"
            onClick={() => handleSelectView("research-domains")}
          />
          {views
            .filter((view) => view.slug !== "research-domains")
            .map((view) => (
              <ViewButton
                key={view.slug}
                active={selectedView === view.slug}
                icon={viewIcon(view.slug)}
                label={view.name}
                onClick={() => handleSelectView(view.slug)}
              />
            ))}
          <ViewButton
            active={false}
            icon={<Grid2X2 size={16} />}
            label="Custom View"
            suffix="+"
            onClick={() => undefined}
          />
        </nav>

        <div className="mt-8 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:mt-9 sm:text-[10px] sm:tracking-[0.16em]">
          Layers
        </div>
        <div className="mt-3 space-y-3">
          {Object.entries(layers).map(([key, enabled]) => (
            <label
              key={key}
              className="flex items-center justify-between gap-2 text-[11px] font-medium capitalize text-slate-700 sm:gap-3 sm:text-[12px]"
            >
              <span className="flex items-center gap-2">
                <ListFilter size={13} />
                <span className="hidden sm:inline">{key}</span>
              </span>
              <button
                type="button"
                aria-pressed={enabled}
                className={`relative h-5 w-9 rounded-full transition ${
                  enabled ? "bg-blue-600" : "bg-slate-200"
                }`}
                onClick={() =>
                  setLayers((current) => ({
                    ...current,
                    [key]: !current[key as keyof LayerToggles],
                  }))
                }
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${
                    enabled ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </button>
            </label>
          ))}
        </div>

        <div className="mt-8 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:text-[10px] sm:tracking-[0.16em]">
          Filters
        </div>
        <div className="mt-4 hidden text-[12px] text-slate-500 sm:block">No active filters</div>
        <button className="mt-4 flex items-center gap-2 text-[12px] font-medium text-slate-700">
          <ListFilter size={14} />
          <span className="hidden sm:inline">Add filter</span>
        </button>

        <div className="mt-auto space-y-5 text-[12px] font-medium text-slate-700">
          <button className="flex items-center gap-3">
            <Settings size={16} />
            <span className="hidden sm:inline">Settings</span>
          </button>
          <button className="flex items-center gap-3">
            <Keyboard size={16} />
            <span className="hidden sm:inline">Shortcuts</span>
          </button>
          <button className="flex items-center gap-3">
            <HelpCircle size={16} />
            <span className="hidden sm:inline">Help</span>
          </button>
        </div>
      </aside>

      <section className="absolute inset-0">
        <SemanticAtlasMap
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
          }}
          onViewportChange={setViewport}
          points={canvasPoints}
          selectedEntityId={selectedEntityId}
          targetMarker={targetMarker}
          viewport={viewport}
        />

        <div className="pointer-events-none absolute inset-0 z-10">
          <header className="pointer-events-auto absolute inset-x-0 top-0 z-20 flex h-[68px] items-center gap-4 border-b border-slate-200/80 bg-white/88 px-4 shadow-[0_1px_10px_rgba(15,23,42,0.04)] backdrop-blur-xl sm:px-5">
            <div className="flex min-w-[172px] items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 bg-white">
                <Activity size={18} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold tracking-normal text-slate-950">
                  Semantic Atlas
                </div>
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                  {stats ? `${stats.pointRows.toLocaleString()} points` : "Loading"}
                </div>
              </div>
            </div>

            <nav className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
              <TopViewButton
                active={selectedView === "research-domains"}
                label="All Views"
                viewSlug="research-domains"
                onClick={() => handleSelectView("research-domains")}
              />
              {views
                .filter((view) => view.slug !== "research-domains")
                .slice(0, 3)
                .map((view) => (
                  <TopViewButton
                    key={view.slug}
                    active={selectedView === view.slug}
                    label={view.name}
                    viewSlug={view.slug}
                    onClick={() => handleSelectView(view.slug)}
                  />
                ))}
            </nav>

            <div className="ml-auto hidden items-center gap-1 xl:flex">
              <div className="mr-1 flex items-center gap-1 rounded-md border border-slate-200/80 bg-white/70 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                <Layers3 size={13} />
                Layers
              </div>
              {Object.entries(layers).map(([key, enabled]) => (
                <LayerPill
                  key={key}
                  active={enabled}
                  label={key}
                  onClick={() =>
                    setLayers((current) => ({
                      ...current,
                      [key]: !current[key as keyof LayerToggles],
                    }))
                  }
                />
              ))}
            </div>

            <button
              className="atlas-control grid h-10 w-10 shrink-0 place-items-center rounded-md opacity-45"
              aria-label="Help"
              disabled
            >
              <HelpCircle size={17} />
            </button>
          </header>

          <div className="pointer-events-auto absolute left-3 right-3 top-[78px] sm:left-auto sm:right-5 sm:w-[620px]">
            <AtlasSearch
              selectedView={selectedView}
              onResultSelect={handleSearchResult}
            />
          </div>

          <div
            className={`pointer-events-auto absolute right-3 top-[152px] hidden flex-col gap-2 sm:flex ${
              inspectorOpen ? "sm:right-[328px]" : "sm:right-5"
            }`}
          >
            <AtlasControls
              onHome={() => setViewport(ATLAS_INITIAL_VIEWPORT)}
              onZoomStep={handleZoomStep}
            />
          </div>

          {DEBUG_PANEL_ENABLED ? (
            <div className="pointer-events-auto absolute left-5 top-[88px] hidden sm:block">
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
            <div className="atlas-panel pointer-events-none absolute left-[52%] top-[47%] w-[228px] rounded-md px-3 py-2 text-[12px]">
              <div className="font-semibold text-slate-950">{hoveredPoint.label}</div>
              <div className="mt-1 text-slate-500">
                {hoveredPoint.entityType} · {hoveredPoint.clusterId}
              </div>
            </div>
          ) : hoveredCluster ? (
            <div className="atlas-panel pointer-events-none absolute left-[52%] top-[47%] w-[228px] rounded-md px-3 py-2 text-[12px]">
              <div className="font-semibold text-slate-950">{hoveredCluster.label}</div>
              <div className="mt-1 text-slate-500">
                {hoveredCluster.pointCount.toLocaleString()} points ·{" "}
                {hoveredCluster.clusterId}
              </div>
            </div>
          ) : null}

          <div className="pointer-events-auto absolute bottom-3 left-1/2 w-[min(620px,calc(100%-24px))] -translate-x-1/2 sm:bottom-4">
            <LodStrip
              active={lod.layer}
              zoom={viewport.zoom}
              onZoomChange={(zoom) =>
                setViewport((current) => ({ ...current, zoom }))
              }
            />
          </div>

          <div className="pointer-events-auto absolute bottom-0 right-2 hidden h-8 items-center gap-6 text-[12px] text-slate-500 sm:flex sm:right-4">
            <span>
              {stats ? stats.pointRows.toLocaleString() : "Loading"} of{" "}
              {stats ? stats.pointRows.toLocaleString() : "atlas"} points
            </span>
            <span>FP32</span>
            <span>v0.1.0</span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Online
            </span>
          </div>
        </div>
      </section>

      <AtlasSidePanel
        cluster={featuredCluster}
        neighborClusters={canvasClusters}
        entityId={selectedEntityId}
        onClose={() => {
          if (selectedEntityId) {
            setSelectedEntityId(null);
          } else {
            setClusterInspectorDismissed(true);
          }
        }}
      />
    </main>
  );
}

function viewIcon(slug: string) {
  if (slug.includes("topic")) return <BookOpen size={16} />;
  if (slug.includes("document")) return <FileText size={16} />;
  if (slug.includes("language")) return <Languages size={16} />;
  return <Globe2 size={16} />;
}

function ViewButton({
  active,
  icon,
  label,
  onClick,
  suffix,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  suffix?: string;
}) {
  return (
    <button
      type="button"
      className={`flex h-9 w-full items-center gap-3 rounded-md px-2 text-left text-[12px] font-medium transition ${
        active
          ? "border-l-2 border-blue-600 bg-slate-100 text-slate-950"
          : "text-slate-700 hover:bg-white"
      }`}
      onClick={onClick}
    >
      {icon}
      <span className="hidden min-w-0 flex-1 truncate sm:inline">{label}</span>
      {suffix ? <span className="hidden text-base leading-none sm:inline">{suffix}</span> : null}
    </button>
  );
}

function TopViewButton({
  active,
  label,
  viewSlug,
  onClick,
}: {
  active: boolean;
  label: string;
  viewSlug: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`h-9 max-w-[150px] truncate rounded-md px-3 text-[12px] font-medium transition ${
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "text-slate-600 hover:bg-white hover:text-slate-950"
      }`}
      data-atlas-kind="view-button"
      data-atlas-view={viewSlug}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function LayerPill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`h-8 rounded-md px-2.5 text-[11px] font-medium capitalize transition ${
        active
          ? "bg-emerald-900/90 text-white shadow-sm"
          : "bg-white/70 text-slate-500 hover:bg-white hover:text-slate-900"
      }`}
      data-atlas-kind="layer-toggle"
      data-atlas-layer={label}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function LodStrip({
  active,
  zoom,
  onZoomChange,
}: {
  active: AtlasLodLayer;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}) {
  const displayZoom = atlasZoomToDisplayZoom(zoom);
  const zoomMin = ATLAS_VISUAL_CONFIG.zoom.displayMin;
  const zoomMax = ATLAS_VISUAL_CONFIG.zoom.displayMax;
  const pct = ((displayZoom - zoomMin) / (zoomMax - zoomMin)) * 100;
  return (
    <div className="atlas-panel flex h-[72px] items-center gap-3 rounded-md px-3 sm:h-[78px] sm:gap-4 sm:px-4">
      <div className="hidden w-[54px] text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:block">
        Zoom
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="grid w-[210px] grid-cols-3 gap-1">
          {(["density", "clusters", "points"] as AtlasLodLayer[]).map((layer) => (
            <button
              key={layer}
              type="button"
              aria-pressed={active === layer}
              className={`h-9 rounded-sm text-[11px] font-medium capitalize transition sm:text-[12px] ${
                active === layer
                  ? "bg-white text-slate-950 shadow-sm"
                  : "bg-slate-100/80 text-slate-500"
              }`}
              data-atlas-kind="lod-button"
              data-atlas-lod={layer}
              onClick={() =>
                onZoomChange(layer === "density" ? 1.2 : layer === "clusters" ? 4.2 : 7.2)
              }
            >
              {layer}
            </button>
          ))}
        </div>
        <div className="relative h-9 min-w-0 flex-1">
          <div className="absolute left-0 right-0 top-3 h-1 rounded-full bg-slate-200" />
          <div
            className="absolute left-0 top-3 h-1 rounded-full bg-blue-500"
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
          <input
            aria-label="Zoom"
            className="absolute inset-x-0 top-0 h-7 w-full cursor-pointer opacity-0"
            max={zoomMax}
            min={zoomMin}
            step={0.1}
            type="range"
            value={displayZoom}
            onChange={(event) =>
              onZoomChange(displayZoomToAtlasZoom(Number(event.target.value)))
            }
          />
          <div
            className="absolute top-0 h-6 w-6 -translate-x-1/2 rounded-full border-2 border-blue-500 bg-white shadow"
            style={{ left: `${Math.min(100, Math.max(0, pct))}%` }}
          />
          <div className="absolute top-7 flex w-full justify-between text-[10px] text-slate-500">
            {[-10, -4, 0, 5, 10].map((tick) => (
              <span key={tick}>{tick > 0 ? `+${tick}` : tick}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AtlasViewer() {
  return (
    <QueryProvider>
      <AtlasViewerInner />
    </QueryProvider>
  );
}
