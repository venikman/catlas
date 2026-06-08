"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchAtlasEntity } from "@/lib/atlas/api";
import { ATLAS_CLIENT_CACHE } from "@/lib/atlas/cachePolicy";
import { atlasQueryKeys } from "@/lib/atlas/queryKeys";
import type { LayerToggles } from "@catlas/atlas-react";
import type { AtlasCluster, AtlasEntityDetails, AtlasView } from "@/lib/atlas/types";
import { AtlasIcon } from "./AtlasIcon";

type SidecarTab = "inspect" | "view";

export function AtlasSidePanel({
  cluster,
  entityId,
  layers,
  onClearSelection,
  onLayerToggle,
  onSelectView,
  onCloseRail,
  selectedView,
  views,
}: {
  cluster: AtlasCluster | null;
  entityId: string | null;
  layers: LayerToggles;
  onClearSelection: () => void;
  onLayerToggle: (key: keyof LayerToggles) => void;
  onSelectView: (slug: string) => void;
  onCloseRail: () => void;
  selectedView: string;
  views: AtlasView[];
}) {
  const [tab, setTab] = useState<SidecarTab>("inspect");
  const entityQuery = useQuery({
    enabled: Boolean(entityId),
    queryKey: atlasQueryKeys.entity(entityId ?? ""),
    queryFn: ({ signal }) => fetchAtlasEntity(entityId ?? "", signal),
    staleTime: ATLAS_CLIENT_CACHE.entity.staleTime,
    gcTime: ATLAS_CLIENT_CACHE.entity.gcTime,
  });

  const entity = entityQuery.data?.entity;
  const selectedTitle = entity?.label ?? cluster?.label ?? null;
  const selectedKind = entity ? "Document record" : cluster ? "Cluster scope" : null;

  return (
    <aside className="atlas-rail" data-testid="atlas-side-panel">
      <header className="sidecar-header">
        <div>
          <span>Member ontology</span>
          <h2>Inspect surface</h2>
        </div>
        <button type="button" aria-label="Collapse rail" onClick={onCloseRail}>
          <AtlasIcon name="close" size={16} />
        </button>
      </header>

      <div className="sidecar-tabs">
        <button
          type="button"
          className={tab === "inspect" ? "active" : ""}
          onClick={() => setTab("inspect")}
        >
          Inspect
        </button>
        <button
          type="button"
          className={tab === "view" ? "active" : ""}
          onClick={() => setTab("view")}
        >
          View
        </button>
      </div>

      <div className="sidecar-main atlas-scrollbar">
        {tab === "inspect" ? (
          <InspectPanel
            cluster={cluster}
            entity={entity}
            entityLoading={entityQuery.isLoading}
            onClearSelection={onClearSelection}
            selectedKind={selectedKind}
            selectedTitle={selectedTitle}
          />
        ) : (
          <ViewPanel
            layers={layers}
            onLayerToggle={onLayerToggle}
            onSelectView={onSelectView}
            selectedView={selectedView}
            views={views}
          />
        )}
      </div>
    </aside>
  );
}

function InspectPanel({
  cluster,
  entity,
  entityLoading,
  onClearSelection,
  selectedKind,
  selectedTitle,
}: {
  cluster: AtlasCluster | null;
  entity: AtlasEntityDetails | undefined;
  entityLoading: boolean;
  onClearSelection: () => void;
  selectedKind: string | null;
  selectedTitle: string | null;
}) {
  const hasSelection = Boolean(entity || cluster);

  return (
    <>
      <section className="rail-section">
        <header>
          <h2>Selection</h2>
        </header>
        <div>
          <div className="selection-scope-card">
            <div>
              <span>Active scope</span>
              <strong>{selectedTitle ?? "No selection"}</strong>
            </div>
            <dl>
              <div>
                <dt>Kind</dt>
                <dd>{selectedKind ?? "—"}</dd>
              </div>
              <div>
                <dt>Docs</dt>
                <dd>
                  {cluster
                    ? cluster.pointCount.toLocaleString()
                    : entity
                      ? "1"
                      : "—"}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="rail-section data-preview-section">
        <header>
          <h2>Data preview</h2>
        </header>
        <div>
          {!hasSelection ? (
            <div className="empty-selection">
              <EmptyArt />
            </div>
          ) : entityLoading ? (
            <div className="px-4 py-5 text-[var(--body)] text-[var(--fg-3)]">
              Loading document record...
            </div>
          ) : entity ? (
            <div className="preview-card">
              <small>Document record</small>
              <h3>{entity.label}</h3>
              <p>{entity.payloadSummary}</p>
              <dl>
                <div>
                  <dt>Acuity</dt>
                  <dd>74</dd>
                </div>
                <div>
                  <dt>Continuity</dt>
                  <dd>38</dd>
                </div>
                <div>
                  <dt>Feature vec</dt>
                  <dd>8D demo</dd>
                </div>
              </dl>
              <button type="button" onClick={onClearSelection}>
                Clear selection
              </button>
            </div>
          ) : cluster ? (
            <div className="preview-card">
              <small>Cluster scope</small>
              <h3>{cluster.label}</h3>
              <p>
                {cluster.pointCount.toLocaleString()} represented docs in this
                cluster. Sample-scaled synthetic coordinates.
              </p>
              <dl>
                <div>
                  <dt>Points</dt>
                  <dd>{cluster.pointCount.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Cluster</dt>
                  <dd>{cluster.clusterId}</dd>
                </div>
                <div>
                  <dt>Importance</dt>
                  <dd>{cluster.importance.toFixed(2)}</dd>
                </div>
              </dl>
              <button type="button" onClick={onClearSelection}>
                Clear selection
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

function ViewPanel({
  layers,
  onLayerToggle,
  onSelectView,
  selectedView,
  views,
}: {
  layers: LayerToggles;
  onLayerToggle: (key: keyof LayerToggles) => void;
  onSelectView: (slug: string) => void;
  selectedView: string;
  views: AtlasView[];
}) {
  return (
    <div className="settings-panel">
      <fieldset className="lens-presets">
        <legend>Projection view</legend>
        <div>
          {views.map((view) => (
            <button
              key={view.slug}
              type="button"
              className={view.slug === selectedView ? "active" : ""}
              aria-pressed={view.slug === selectedView}
              data-atlas-kind="view-button"
              data-atlas-view={view.slug}
              onClick={() => onSelectView(view.slug)}
            >
              <span className="lens-preview ontology" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <span>
                <strong>{view.name}</strong>
                <em>{view.description}</em>
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {Object.entries(layers).map(([key, enabled]) => (
        <button
          key={key}
          type="button"
          className="toggle-control"
          aria-pressed={enabled}
          data-atlas-kind="layer-toggle"
          data-atlas-layer={key}
          onClick={() => onLayerToggle(key as keyof LayerToggles)}
        >
          <span aria-hidden="true" />
          <strong className="capitalize">{key}</strong>
        </button>
      ))}
    </div>
  );
}

function EmptyArt() {
  return (
    <svg className="empty-selection-art" viewBox="0 0 260 190" aria-hidden="true">
      <path d="M41 133c-20-14-25-41 3-51 43-16 65 63 106 41" />
      <path d="M115 38c33 36 71 50 92 36 24-16-9-55-57-35" />
      <path d="M93 68l60 50M154 118l-12-2M154 118l-5-12M170 34l28 40M198 74l-4-13M198 74l-14-1" />
      <text x="50" y="95">
        Create a selection
      </text>
      <text x="60" y="133">
        Explore the map
      </text>
    </svg>
  );
}
