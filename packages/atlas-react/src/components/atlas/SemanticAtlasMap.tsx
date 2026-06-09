"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  ATLAS_DEFAULT_WORLD_BOUNDS,
  type AtlasWorldBounds,
} from "../../contract/atlasStore";
import { getLodForZoom } from "../../lib/atlas/lod";
import type {
  AtlasBbox,
  AtlasCluster,
  AtlasDensityTile,
  AtlasLodLayer,
  AtlasPoint,
} from "../../lib/atlas/types";
import {
  resolveAtlasPalette,
  type AtlasThemePalette,
} from "../../lib/atlas/visualConfig";
import { AtlasCanvas } from "./AtlasCanvas";
import {
  ATLAS_INITIAL_LAYERS,
  ATLAS_INITIAL_VIEWPORT,
  type AtlasViewportState,
  type LayerToggles,
} from "./atlasComponentTypes";
import { bboxForViewport } from "./viewportBounds";

type AtlasTargetMarker = {
  id: string;
  label?: string;
  x: number;
  y: number;
};

export type AtlasRendererStatus =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "error";

export type SemanticAtlasMapProps = {
  bbox?: AtlasBbox;
  capped?: boolean;
  className?: string;
  clusters?: AtlasCluster[];
  densityTiles?: AtlasDensityTile[];
  emptyState?: ReactNode;
  errorState?: ReactNode;
  hoveredEntityId?: string | null;
  initialViewport?: AtlasViewportState;
  layers?: Partial<LayerToggles>;
  loadingOverlay?: ReactNode;
  lod?: AtlasLodLayer;
  onHoverCluster?: (cluster: AtlasCluster | null) => void;
  onHoverPoint?: (point: AtlasPoint | null) => void;
  onSelectCluster?: (cluster: AtlasCluster) => void;
  onSelectPoint?: (point: AtlasPoint) => void;
  onViewportChange?: (viewport: AtlasViewportState) => void;
  points?: AtlasPoint[];
  renderedCount?: number;
  selectedEntityId?: string | null;
  status?: AtlasRendererStatus;
  style?: CSSProperties;
  targetMarker?: AtlasTargetMarker | null;
  theme?: AtlasThemePalette;
  viewport?: AtlasViewportState;
  worldBounds?: AtlasWorldBounds;
};

export { bboxForViewport };

const OVERLAY_STYLE: CSSProperties = {
  alignItems: "center",
  background: "rgba(244, 244, 241, 0.92)",
  display: "flex",
  inset: 0,
  justifyContent: "center",
  position: "absolute",
  zIndex: 10,
};

const STATUS_BADGE_STYLE: CSSProperties = {
  background: "rgba(255, 255, 255, 0.88)",
  border: "1px solid rgba(15, 23, 42, 0.12)",
  borderRadius: 6,
  bottom: 12,
  color: "#475569",
  fontSize: 12,
  left: 12,
  lineHeight: 1.4,
  padding: "6px 10px",
  pointerEvents: "none",
  position: "absolute",
  zIndex: 11,
};

const DEFAULT_LOADING_OVERLAY = (
  <div aria-busy="true" role="status" style={{ color: "#475569", fontSize: 14 }}>
    Loading atlas…
  </div>
);

const DEFAULT_EMPTY_STATE = (
  <div role="status" style={{ color: "#475569", fontSize: 14 }}>
    No atlas data in view.
  </div>
);

const DEFAULT_ERROR_STATE = (
  <div role="alert" style={{ color: "#b91c1c", fontSize: 14 }}>
    Unable to load atlas data.
  </div>
);

function hasAtlasData(input: {
  clusters: AtlasCluster[];
  densityTiles: AtlasDensityTile[];
  points: AtlasPoint[];
}): boolean {
  return (
    input.clusters.length > 0 ||
    input.densityTiles.length > 0 ||
    input.points.length > 0
  );
}

export function SemanticAtlasMap({
  bbox,
  capped = false,
  className,
  clusters = [],
  densityTiles = [],
  emptyState,
  errorState,
  hoveredEntityId = null,
  initialViewport = ATLAS_INITIAL_VIEWPORT,
  layers,
  loadingOverlay,
  lod,
  onHoverCluster,
  onHoverPoint,
  onSelectCluster,
  onSelectPoint,
  onViewportChange,
  points = [],
  renderedCount,
  selectedEntityId = null,
  status = "idle",
  style,
  targetMarker = null,
  theme,
  viewport,
  worldBounds = ATLAS_DEFAULT_WORLD_BOUNDS,
}: SemanticAtlasMapProps) {
  const [internalViewport, setInternalViewport] =
    useState<AtlasViewportState>(initialViewport);
  const activeViewport = viewport ?? internalViewport;
  const activeLayers = useMemo<LayerToggles>(
    () => ({ ...ATLAS_INITIAL_LAYERS, ...layers }),
    [layers],
  );
  const activeBbox = bbox ?? bboxForViewport(activeViewport, worldBounds);
  const activeLod = lod ?? getLodForZoom(activeViewport.zoom).layer;
  const palette = useMemo(() => resolveAtlasPalette(theme), [theme]);
  const dataPresent = hasAtlasData({ clusters, densityTiles, points });
  const resolvedStatus = useMemo<AtlasRendererStatus>(() => {
    if (status === "ready" && !dataPresent) {
      return "empty";
    }
    return status;
  }, [dataPresent, status]);
  const showCanvas =
    resolvedStatus !== "loading" &&
    resolvedStatus !== "error" &&
    resolvedStatus !== "empty";
  const countForA11y = renderedCount ?? points.length;

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      viewport != null &&
      !onViewportChange
    ) {
      console.warn(
        "[SemanticAtlasMap] Received a controlled `viewport` prop without `onViewportChange`. " +
          "Viewport updates from pan/zoom will not propagate to the parent.",
      );
    }
  }, [onViewportChange, viewport]);

  const rootStyle = useMemo<CSSProperties>(
    () => ({
      background: palette.paper,
      height: "100%",
      minHeight: 480,
      overflow: "hidden",
      position: "relative",
      width: "100%",
      ...style,
    }),
    [palette.paper, style],
  );

  const setViewport = useCallback(
    (update: SetStateAction<AtlasViewportState>) => {
      const nextViewport =
        typeof update === "function" ? update(activeViewport) : update;
      if (!viewport) setInternalViewport(nextViewport);
      onViewportChange?.(nextViewport);
    },
    [activeViewport, onViewportChange, viewport],
  );

  return (
    <div
      className={className}
      data-atlas-capped={capped ? "true" : "false"}
      data-atlas-rendered-count={countForA11y}
      data-atlas-status={resolvedStatus}
      data-testid="semantic-atlas-map"
      style={rootStyle}
    >
      {showCanvas ? (
        <AtlasCanvas
          bbox={activeBbox}
          clusters={clusters}
          densityTiles={densityTiles}
          hoveredEntityId={hoveredEntityId}
          layers={activeLayers}
          lod={activeLod}
          onHoverCluster={onHoverCluster ?? (() => undefined)}
          onHoverPoint={onHoverPoint ?? (() => undefined)}
          onSelectCluster={onSelectCluster ?? (() => undefined)}
          onSelectPoint={onSelectPoint ?? (() => undefined)}
          palette={palette}
          points={points}
          renderedCount={countForA11y}
          selectedEntityId={selectedEntityId}
          setViewport={setViewport}
          targetMarker={targetMarker}
          viewport={activeViewport}
          worldBounds={worldBounds}
        />
      ) : null}

      {resolvedStatus === "loading" ? (
        <div aria-live="polite" style={OVERLAY_STYLE}>
          {loadingOverlay ?? DEFAULT_LOADING_OVERLAY}
        </div>
      ) : null}

      {resolvedStatus === "error" ? (
        <div aria-live="assertive" style={OVERLAY_STYLE}>
          {errorState ?? DEFAULT_ERROR_STATE}
        </div>
      ) : null}

      {resolvedStatus === "empty" ? (
        <div aria-live="polite" style={OVERLAY_STYLE}>
          {emptyState ?? DEFAULT_EMPTY_STATE}
        </div>
      ) : null}

      {resolvedStatus === "ready" && (capped || renderedCount != null) ? (
        <div aria-live="polite" role="status" style={STATUS_BADGE_STYLE}>
          {renderedCount != null ? `${renderedCount} rendered` : null}
          {renderedCount != null && capped ? " · " : null}
          {capped ? "Results capped" : null}
        </div>
      ) : null}
    </div>
  );
}
