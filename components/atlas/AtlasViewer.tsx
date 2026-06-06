"use client";

import dynamic from "next/dynamic";
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
  ListFilter,
  Settings,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { fetchAtlasViews, fetchViewportData } from "@/lib/atlas/api";
import { getLodForZoom, zoomBandForZoom } from "@/lib/atlas/lod";
import { expandBbox } from "@/lib/atlas/math";
import { atlasQueryKeys } from "@/lib/atlas/queryKeys";
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
import { AtlasSearch } from "./AtlasSearch";
import { AtlasSidePanel } from "./AtlasSidePanel";

const AtlasCanvas = dynamic(
  () => import("./AtlasCanvas").then((module) => module.AtlasCanvas),
  { ssr: false },
);

export type AtlasViewportState = {
  centerX: number;
  centerY: number;
  zoom: number;
};

export type LayerToggles = {
  density: boolean;
  clusters: boolean;
  points: boolean;
  labels: boolean;
  boundaries: boolean;
  heat: boolean;
  links: boolean;
};

const INITIAL_VIEWPORT: AtlasViewportState = {
  centerX: 1.1,
  centerY: 0.42,
  zoom: 3.08,
};

const INITIAL_LAYERS: LayerToggles = {
  density: true,
  clusters: true,
  points: false,
  labels: true,
  boundaries: true,
  heat: false,
  links: false,
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
  const [viewport, setViewport] = useState<AtlasViewportState>(INITIAL_VIEWPORT);
  const [layers, setLayers] = useState<LayerToggles>(INITIAL_LAYERS);
  const [hoveredPoint, setHoveredPoint] = useState<AtlasPoint | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [clusterInspectorDismissed, setClusterInspectorDismissed] = useState(false);
  const [, startTransition] = useTransition();

  const viewsQuery = useQuery({
    queryKey: atlasQueryKeys.views(),
    queryFn: ({ signal }) => fetchAtlasViews(signal),
    staleTime: 60_000,
  });

  const views = viewsQuery.data?.views ?? FALLBACK_VIEWS;
  const stats = viewsQuery.data?.stats;
  const lod = getLodForZoom(viewport.zoom);
  const bbox = useMemo(() => computeBbox(viewport), [viewport]);
  const debouncedViewport = useDebouncedValue({ bbox, zoom: viewport.zoom }, 140);
  const fetchBbox = useMemo(
    () => expandBbox(debouncedViewport.bbox, 1.18),
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
    staleTime: 8_000,
  });

  const densityTiles = extractDensityTiles(viewportQuery.data);
  const clusters = extractClusters(viewportQuery.data);
  const points = extractPoints(viewportQuery.data);
  const featuredCluster = clusterInspectorDismissed
    ? null
    : clusters.find((cluster) => cluster.clusterId === "graph-neural-networks") ??
      clusters[0] ??
      null;

  function handleSelectView(nextView: string) {
    startTransition(() => {
      setSelectedView(nextView);
      setClusterInspectorDismissed(false);
      setLayers((current) => ({
        ...current,
        density: true,
        clusters: true,
        labels: true,
      }));
    });
  }

  function handleSearchResult(result: AtlasSearchResult) {
    setViewport({
      centerX: result.x,
      centerY: result.y,
      zoom: Math.max(viewport.zoom, 7.05),
    });
    setSelectedEntityId(result.entityId);
    setClusterInspectorDismissed(false);
  }

  function handleZoomStep(delta: number) {
    setViewport((current) => ({
      ...current,
      zoom: Math.min(9.5, Math.max(-1.5, Number((current.zoom + delta).toFixed(2)))),
    }));
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#f8f6f0]">
      <aside className="absolute inset-y-0 left-0 z-20 flex w-[72px] flex-col border-r border-slate-200/80 bg-white/72 px-3 py-5 backdrop-blur-xl sm:w-[176px] sm:px-5 sm:py-6">
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

      <section className="absolute inset-y-0 left-[72px] right-0 sm:left-[176px]">
        <AtlasCanvas
          bbox={bbox}
          clusters={clusters}
          densityTiles={densityTiles}
          layers={layers}
          lod={lod.layer}
          onHoverPoint={setHoveredPoint}
          onSelectPoint={(point) => setSelectedEntityId(point.entityId)}
          points={points}
          selectedEntityId={selectedEntityId}
          setViewport={setViewport}
          viewport={viewport}
        />

        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="pointer-events-auto absolute left-2 right-2 top-3 sm:left-5 sm:right-auto sm:top-5">
            <AtlasSearch
              selectedView={selectedView}
              onResultSelect={handleSearchResult}
            />
          </div>

          <div className="pointer-events-auto absolute right-2 top-[92px] hidden flex-col gap-2 sm:right-[328px] sm:top-5 sm:flex">
            <AtlasControls onZoomStep={handleZoomStep} />
          </div>

          {hoveredPoint ? (
            <div className="atlas-panel pointer-events-none absolute left-[52%] top-[47%] w-[228px] rounded-md px-3 py-2 text-[12px]">
              <div className="font-semibold text-slate-950">{hoveredPoint.label}</div>
              <div className="mt-1 text-slate-500">
                {hoveredPoint.entityType} · {hoveredPoint.clusterId}
              </div>
            </div>
          ) : null}

          <div className="pointer-events-auto absolute inset-x-2 bottom-2 sm:inset-x-5 sm:bottom-5">
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
        neighborClusters={clusters}
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

function LodStrip({
  active,
  zoom,
  onZoomChange,
}: {
  active: AtlasLodLayer;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}) {
  const pct = ((zoom + 1.5) / 11) * 100;
  return (
    <div className="atlas-panel flex h-[96px] items-center gap-3 rounded-lg px-3 sm:h-[126px] sm:gap-7 sm:px-4">
      <div className="hidden w-[74px] text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:block">
        LOD Mode
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          {(["density", "clusters", "points"] as AtlasLodLayer[]).map((layer) => (
            <button
              key={layer}
              type="button"
              className={`h-9 rounded-md text-[12px] font-medium capitalize transition sm:h-10 sm:text-[13px] ${
                active === layer
                  ? "bg-white text-slate-950 shadow-sm"
                  : "bg-slate-100/70 text-slate-500"
              }`}
              onClick={() =>
                onZoomChange(layer === "density" ? 1.2 : layer === "clusters" ? 4.2 : 7.2)
              }
            >
              {layer}
            </button>
          ))}
        </div>
        <div className="relative h-9">
          <div className="absolute left-0 right-0 top-3 h-1 rounded-full bg-slate-200" />
          <div
            className="absolute left-0 top-3 h-1 rounded-full bg-blue-500"
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
          <input
            aria-label="Zoom"
            className="absolute inset-x-0 top-0 h-7 w-full cursor-pointer opacity-0"
            max={9.5}
            min={-1.5}
            step={0.05}
            type="range"
            value={zoom}
            onChange={(event) => onZoomChange(Number(event.target.value))}
          />
          <div
            className="absolute top-0 h-6 w-6 -translate-x-1/2 rounded-full border-2 border-blue-500 bg-white shadow"
            style={{ left: `${Math.min(100, Math.max(0, pct))}%` }}
          />
          <div className="absolute top-7 flex w-full justify-between text-[10px] text-slate-500 sm:text-[11px]">
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
