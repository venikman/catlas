"use client";

import {
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
  type SetStateAction,
} from "react";
import type {
  AtlasBbox,
  AtlasCluster,
  AtlasDensityTile,
  AtlasLodLayer,
  AtlasPoint,
} from "../../lib/atlas/types";
import { AtlasCanvas } from "./AtlasCanvas";
import {
  ATLAS_INITIAL_LAYERS,
  ATLAS_INITIAL_VIEWPORT,
  type AtlasViewportState,
  type LayerToggles,
} from "./atlasComponentTypes";

type AtlasTargetMarker = {
  id: string;
  label?: string;
  x: number;
  y: number;
};

export type SemanticAtlasMapProps = {
  bbox?: AtlasBbox;
  className?: string;
  clusters?: AtlasCluster[];
  densityTiles?: AtlasDensityTile[];
  hoveredEntityId?: string | null;
  initialViewport?: AtlasViewportState;
  layers?: Partial<LayerToggles>;
  lod?: AtlasLodLayer;
  onHoverCluster?: (cluster: AtlasCluster | null) => void;
  onHoverPoint?: (point: AtlasPoint | null) => void;
  onSelectCluster?: (cluster: AtlasCluster) => void;
  onSelectPoint?: (point: AtlasPoint) => void;
  onViewportChange?: (viewport: AtlasViewportState) => void;
  points?: AtlasPoint[];
  selectedEntityId?: string | null;
  style?: CSSProperties;
  targetMarker?: AtlasTargetMarker | null;
  viewport?: AtlasViewportState;
};

export function bboxForViewport(viewport: AtlasViewportState): AtlasBbox {
  const spanX = 15 / Math.pow(1.32, viewport.zoom);
  const spanY = spanX * 0.72;
  return {
    minX: Number((viewport.centerX - spanX / 2).toFixed(4)),
    maxX: Number((viewport.centerX + spanX / 2).toFixed(4)),
    minY: Number((viewport.centerY - spanY / 2).toFixed(4)),
    maxY: Number((viewport.centerY + spanY / 2).toFixed(4)),
  };
}

export function SemanticAtlasMap({
  bbox,
  className,
  clusters = [],
  densityTiles = [],
  hoveredEntityId = null,
  initialViewport = ATLAS_INITIAL_VIEWPORT,
  layers,
  lod = "density",
  onHoverCluster,
  onHoverPoint,
  onSelectCluster,
  onSelectPoint,
  onViewportChange,
  points = [],
  selectedEntityId = null,
  style,
  targetMarker = null,
  viewport,
}: SemanticAtlasMapProps) {
  const [internalViewport, setInternalViewport] =
    useState<AtlasViewportState>(initialViewport);
  const activeViewport = viewport ?? internalViewport;
  const activeLayers = useMemo<LayerToggles>(
    () => ({ ...ATLAS_INITIAL_LAYERS, ...layers }),
    [layers],
  );
  const activeBbox = bbox ?? bboxForViewport(activeViewport);
  const rootStyle = useMemo<CSSProperties>(
    () => ({
      height: "100%",
      minHeight: 480,
      overflow: "hidden",
      position: "relative",
      width: "100%",
      ...style,
    }),
    [style],
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
      data-testid="semantic-atlas-map"
      style={rootStyle}
    >
      <AtlasCanvas
        bbox={activeBbox}
        clusters={clusters}
        densityTiles={densityTiles}
        hoveredEntityId={hoveredEntityId}
        layers={activeLayers}
        lod={lod}
        onHoverCluster={onHoverCluster ?? (() => undefined)}
        onHoverPoint={onHoverPoint ?? (() => undefined)}
        onSelectCluster={onSelectCluster ?? (() => undefined)}
        onSelectPoint={onSelectPoint ?? (() => undefined)}
        points={points}
        selectedEntityId={selectedEntityId}
        setViewport={setViewport}
        targetMarker={targetMarker}
        viewport={activeViewport}
      />
    </div>
  );
}
