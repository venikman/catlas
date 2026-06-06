"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, Copy, ExternalLink, Maximize2, MoreHorizontal, Pin, Share2, X } from "lucide-react";
import { fetchAtlasEntity } from "@/lib/atlas/api";
import { atlasQueryKeys } from "@/lib/atlas/queryKeys";
import type { AtlasCluster } from "@/lib/atlas/types";

export function AtlasSidePanel({
  cluster,
  entityId,
  neighborClusters,
  onClose,
}: {
  cluster: AtlasCluster | null;
  entityId: string | null;
  neighborClusters: AtlasCluster[];
  onClose: () => void;
}) {
  const entityQuery = useQuery({
    enabled: Boolean(entityId),
    queryKey: atlasQueryKeys.entity(entityId ?? ""),
    queryFn: ({ signal }) => fetchAtlasEntity(entityId ?? "", signal),
    staleTime: 45_000,
  });

  const entity = entityQuery.data?.entity;
  const hasSelection = Boolean(entityId || cluster);

  return (
    <aside
      className={`atlas-panel absolute z-30 flex flex-col rounded-lg ${
        entityId
          ? "bottom-2 left-[82px] right-2 h-[48vh] sm:left-auto sm:right-5 sm:top-5 sm:h-[calc(100vh-172px)] sm:w-[300px]"
          : "right-5 top-5 hidden h-[calc(100vh-172px)] w-[300px] sm:flex"
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Selected
          {cluster && !entityId ? (
            <span className="ml-2 inline-flex items-center gap-1 normal-case tracking-normal text-slate-500">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: cluster.colorKey }}
              />
              Cluster
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-slate-500" />
          <button aria-label="Close inspector" onClick={onClose}>
            <X size={16} className="text-slate-500" />
          </button>
        </div>
      </div>

      {!hasSelection ? (
        <div className="grid flex-1 place-items-center px-6 text-center text-[13px] text-slate-500">
          Select an entity or search result to inspect metadata.
        </div>
      ) : cluster && !entityId ? (
        <ClusterInspector cluster={cluster} neighborClusters={neighborClusters} />
      ) : entityQuery.isLoading ? (
        <div className="px-4 py-5 text-[13px] text-slate-500">Loading entity metadata...</div>
      ) : entityQuery.isError ? (
        <div className="px-4 py-5 text-[13px] text-rose-600">
          Could not load this entity.
        </div>
      ) : entity ? (
        <>
          <div className="border-b border-slate-200 px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-[16px] font-semibold leading-snug text-slate-950">
                  {entity.label}
                </h1>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                  <span>ID: {entity.entityId}</span>
                  <Copy size={13} />
                </div>
              </div>
              <Pin size={15} className="mt-1 text-slate-500" />
            </div>
            <div className="mt-4 flex gap-5 border-b border-slate-200 text-[12px] font-medium">
              <button className="border-b-2 border-blue-600 pb-2 text-blue-600">
                Overview
              </button>
              <button className="pb-2 text-slate-500">Points ({entity.views.length})</button>
            </div>
          </div>

          <div className="atlas-scrollbar flex-1 overflow-y-auto px-4 py-4">
            <SectionTitle>Summary</SectionTitle>
            <p className="mt-2 text-[12px] leading-5 text-slate-700">
              {entity.payloadSummary}
            </p>

            <SectionTitle className="mt-5">Metrics</SectionTitle>
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-2 text-[12px]">
              <dt className="text-slate-500">Views</dt>
              <dd className="font-medium text-slate-800">{entity.views.length}</dd>
              <dt className="text-slate-500">Density local</dt>
              <dd className="font-medium text-slate-800">1.78x</dd>
              <dt className="text-slate-500">Coverage</dt>
              <dd className="font-medium text-slate-800">0.61%</dd>
              <dt className="text-slate-500">Avg. similarity</dt>
              <dd className="font-medium text-slate-800">0.73</dd>
            </dl>

            <SectionTitle className="mt-5">View Coordinates</SectionTitle>
            <div className="mt-2 space-y-2">
              {entity.views.map((view) => (
                <div
                  key={view.viewId}
                  className="rounded-md bg-slate-100/80 px-3 py-2 text-[11px]"
                >
                  <div className="font-medium text-slate-800">
                    {view.viewSlug ?? view.viewId}
                  </div>
                  <div className="mt-1 font-mono text-slate-500">
                    x {view.x.toFixed(3)} · y {view.y.toFixed(3)}
                  </div>
                </div>
              ))}
            </div>

            <SectionTitle className="mt-5">Top Terms</SectionTitle>
            <div className="mt-2 flex flex-wrap gap-2">
              {["graph embeddings", "node classification", "GNN", "GCN", "link prediction", "heterogeneous graphs"].map(
                (term) => (
                  <span
                    key={term}
                    className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700"
                  >
                    {term}
                  </span>
                ),
              )}
            </div>
          </div>

          <div className="flex h-12 items-center justify-between border-t border-slate-200 px-4">
            <button aria-label="Maximize inspector">
              <Maximize2 size={16} className="text-slate-500" />
            </button>
            <button aria-label="Share entity">
              <Share2 size={16} className="text-slate-500" />
            </button>
            <button aria-label="Open entity">
              <ExternalLink size={16} className="text-slate-500" />
            </button>
            <button aria-label="More actions">
              <MoreHorizontal size={17} className="text-slate-500" />
            </button>
          </div>
        </>
      ) : (
        <div className="px-4 py-5 text-[13px] text-slate-500">Entity not found.</div>
      )}
    </aside>
  );
}

function ClusterInspector({
  cluster,
  neighborClusters,
}: {
  cluster: AtlasCluster;
  neighborClusters: AtlasCluster[];
}) {
  const neighbors = neighborClusters
    .filter((candidate) => candidate.id !== cluster.id)
    .sort((a, b) => b.pointCount - a.pointCount)
    .slice(0, 5);
  const pointCount = cluster.pointCount.toLocaleString();

  return (
    <>
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[16px] font-semibold leading-snug text-slate-950">
              {cluster.label}
            </h1>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
              <span>ID: {cluster.clusterId}</span>
              <Copy size={13} />
            </div>
          </div>
          <Pin size={15} className="mt-1 text-slate-500" />
        </div>
        <div className="mt-4 flex gap-5 border-b border-slate-200 text-[12px] font-medium">
          <button className="border-b-2 border-blue-600 pb-2 text-blue-600">
            Overview
          </button>
          <button className="pb-2 text-slate-500">Points ({pointCount})</button>
        </div>
      </div>

      <div className="atlas-scrollbar flex-1 overflow-y-auto px-4 py-4">
        <SectionTitle>Summary</SectionTitle>
        <p className="mt-2 text-[12px] leading-5 text-slate-700">
          Research on neural networks defined on graph structures. Includes GNN
          architectures, training methods, and applications across domains.
        </p>

        <SectionTitle className="mt-5">Metrics</SectionTitle>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-2 text-[12px]">
          <dt className="text-slate-500">Points</dt>
          <dd className="font-medium text-slate-800">{pointCount}</dd>
          <dt className="text-slate-500">Density local</dt>
          <dd className="font-medium text-slate-800">1.78x</dd>
          <dt className="text-slate-500">Coverage</dt>
          <dd className="font-medium text-slate-800">0.61%</dd>
          <dt className="text-slate-500">Avg. similarity</dt>
          <dd className="font-medium text-slate-800">
            {(0.66 + cluster.importance * 0.12).toFixed(2)}
          </dd>
        </dl>

        <SectionTitle className="mt-5">Top Terms</SectionTitle>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            "message passing",
            "graph embeddings",
            "node classification",
            "GCN",
            "GAT",
            "link prediction",
            "heterogeneous graphs",
            "molecules",
          ].map((term) => (
            <span
              key={term}
              className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700"
            >
              {term}
            </span>
          ))}
        </div>

        <SectionTitle className="mt-6">Top Neighboring Clusters</SectionTitle>
        <div className="mt-3 space-y-3 text-[12px]">
          {neighbors.map((neighbor, index) => (
            <div key={neighbor.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: neighbor.colorKey }}
              />
              <span className="truncate text-slate-700">{neighbor.label}</span>
              <span className="text-slate-500">
                {(0.82 - index * 0.07).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex h-12 items-center justify-between border-t border-slate-200 px-4">
        <button aria-label="Maximize inspector">
          <Maximize2 size={16} className="text-slate-500" />
        </button>
        <button aria-label="Share cluster">
          <Share2 size={16} className="text-slate-500" />
        </button>
        <button aria-label="Open cluster">
          <ExternalLink size={16} className="text-slate-500" />
        </button>
        <button aria-label="More actions">
          <MoreHorizontal size={17} className="text-slate-500" />
        </button>
      </div>
    </>
  );
}

function SectionTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 ${className}`}
    >
      {children}
    </div>
  );
}
