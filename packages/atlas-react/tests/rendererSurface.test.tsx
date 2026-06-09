import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ATLAS_DEFAULT_WORLD_BOUNDS,
  ATLAS_SELECTORS,
} from "../src/contract/atlasStore";
import {
  SemanticAtlasMap,
  bboxForViewport,
  viewSpanForWorldBounds,
} from "../src/components/atlas";
import type { AtlasViewportState } from "../src/components/atlas/atlasComponentTypes";
import type { AtlasCluster, AtlasDensityTile, AtlasPoint } from "../src/lib/atlas/types";
import { getPointVisualStyle } from "../src/lib/atlas/visualConfig";

const viewport: AtlasViewportState = { centerX: 0.5, centerY: 0.5, zoom: 0 };

const samplePoint: AtlasPoint = {
  clusterId: "c1",
  entityId: "e1",
  entityType: "concept",
  id: "p1",
  importance: 1,
  label: "Sample",
  viewId: "v1",
  x: 0,
  y: 0,
};

const sampleDensityTile: AtlasDensityTile = {
  bounds: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
  densityPayload: {
    colorKey: "#64748b",
    label: "Alpha",
    points: [{ weight: 1, x: 0, y: 0 }],
  },
  id: "d1",
  pointCount: 1,
  viewId: "v1",
  xTile: 0,
  yTile: 0,
  z: 0,
};

const sampleCluster: AtlasCluster = {
  boundsMaxX: 1,
  boundsMaxY: 1,
  boundsMinX: -1,
  boundsMinY: -1,
  centroidX: 0,
  centroidY: 0,
  clusterId: "cluster-1",
  colorKey: "#2563eb",
  id: "c1",
  importance: 0.5,
  label: "Research",
  lodLevel: 3,
  pointCount: 100,
  radius: 1,
  viewId: "v1",
};

describe("renderer adoption surface", () => {
  it("derives bbox spans from worldBounds per contract §3", () => {
    const unitWorld = { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    const wideWorld = { minX: -100, maxX: 100, minY: -100, maxY: 100 };

    const unitSpan = viewSpanForWorldBounds(0, unitWorld);
    expect(unitSpan.spanX).toBeCloseTo(1 * (15 / 14), 4);
    expect(unitSpan.spanY).toBeCloseTo(unitSpan.spanX * 0.72, 4);

    const wideSpan = viewSpanForWorldBounds(2, wideWorld);
    expect(wideSpan.spanX).toBeCloseTo((200 * (15 / 14)) / Math.pow(1.32, 2), 4);

    const unitBbox = bboxForViewport(viewport, unitWorld);
    expect(unitBbox.minX).toBeCloseTo(0.5 - unitSpan.spanX / 2, 4);
    expect(unitBbox.maxX).toBeCloseTo(0.5 + unitSpan.spanX / 2, 4);
  });

  it("preserves default world behavior when worldBounds is omitted", () => {
    const defaultSpan = viewSpanForWorldBounds(0, ATLAS_DEFAULT_WORLD_BOUNDS);
    expect(defaultSpan.spanX).toBeCloseTo(15, 4);
    expect(defaultSpan.spanY).toBeCloseTo(15 * 0.72, 4);
  });

  it("warns in dev when viewport is controlled without onViewportChange", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    render(
      <SemanticAtlasMap
        onViewportChange={undefined}
        viewport={{ centerX: 0, centerY: 0, zoom: 1 }}
      />,
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("controlled `viewport` prop without `onViewportChange`"),
    );
    warn.mockRestore();
  });

  it("renders distinct loading, error, and empty overlays", () => {
    const { rerender } = render(<SemanticAtlasMap status="loading" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading atlas");

    rerender(<SemanticAtlasMap status="error" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load");

    rerender(<SemanticAtlasMap status="empty" />);
    expect(screen.getByRole("status")).toHaveTextContent("No atlas data");
  });

  it("keeps the canvas mounted while loading", () => {
    render(
      <SemanticAtlasMap
        points={[samplePoint]}
        status="loading"
      />,
    );
    expect(screen.getByTestId("atlas-canvas")).toBeTruthy();
    expect(screen.getByRole("status")).toHaveTextContent("Loading atlas");
  });

  it("shows capped and renderedCount badge when ready", () => {
    render(
      <SemanticAtlasMap
        capped
        points={[samplePoint]}
        renderedCount={42}
        status="ready"
      />,
    );
    expect(screen.getByText("42 rendered · Results capped")).toBeTruthy();
  });

  it("auto-derives lod from zoom when lod prop is omitted", () => {
    render(
      <SemanticAtlasMap
        initialViewport={{ centerX: 0, centerY: 0, zoom: 7 }}
        points={[samplePoint]}
      />,
    );
    expect(document.querySelector('[data-testid="atlas-canvas"]')).toBeTruthy();
  });

  it("emits canonical selectors exactly once", () => {
    render(
      <SemanticAtlasMap densityTiles={[sampleDensityTile]} status="ready" />,
    );

    expect(document.querySelectorAll(ATLAS_SELECTORS.root)).toHaveLength(1);
    expect(document.querySelectorAll(ATLAS_SELECTORS.graph)).toHaveLength(1);
  });

  it("supports keyboard pan and zoom on the interactive surface", () => {
    const onViewportChange = vi.fn();
    render(
      <SemanticAtlasMap
        initialViewport={{ centerX: 0, centerY: 0, zoom: 1 }}
        onViewportChange={onViewportChange}
        points={[samplePoint]}
        status="ready"
      />,
    );

    const surface = screen.getByRole("application");
    surface.focus();
    fireEvent.keyDown(surface, { key: "ArrowRight" });
    fireEvent.keyDown(surface, { key: "+" });

    expect(onViewportChange).toHaveBeenCalled();
    const lastCall = onViewportChange.mock.calls.at(-1)?.[0] as AtlasViewportState;
    expect(lastCall.centerX).toBeGreaterThan(0);
    expect(lastCall.zoom).toBeGreaterThan(1);
  });

  it("applies sequential functional viewport updates against latest state", () => {
    const onViewportChange = vi.fn();
    render(
      <SemanticAtlasMap
        initialViewport={{ centerX: 0, centerY: 0, zoom: 1 }}
        onViewportChange={onViewportChange}
        points={[samplePoint]}
        status="ready"
      />,
    );

    const surface = screen.getByRole("application");
    surface.focus();
    act(() => {
      fireEvent.keyDown(surface, { key: "ArrowRight" });
      fireEvent.keyDown(surface, { key: "ArrowRight" });
    });

    expect(onViewportChange.mock.calls.length).toBeGreaterThanOrEqual(2);
    const first = onViewportChange.mock.calls[0]?.[0] as AtlasViewportState;
    const second = onViewportChange.mock.calls[1]?.[0] as AtlasViewportState;
    expect(second.centerX).toBeGreaterThan(first.centerX);
  });

  it("ignores keyboard zoom when modifier keys are pressed", () => {
    const onViewportChange = vi.fn();
    render(
      <SemanticAtlasMap
        initialViewport={{ centerX: 0, centerY: 0, zoom: 1 }}
        onViewportChange={onViewportChange}
        points={[samplePoint]}
        status="ready"
      />,
    );

    const surface = screen.getByRole("application");
    surface.focus();
    fireEvent.keyDown(surface, { altKey: true, key: "+" });
    fireEvent.keyDown(surface, { key: "+", metaKey: true });

    expect(onViewportChange).not.toHaveBeenCalled();
  });

  it("applies theme palette overrides to the map surface", () => {
    render(
      <SemanticAtlasMap
        points={[samplePoint]}
        status="ready"
        theme={{ paper: "#001122" }}
      />,
    );

    const surface = screen.getByTestId("atlas-canvas");
    expect(surface).toHaveStyle({ background: "#001122" });
  });

  it("keeps marker-only ready states on the canvas", () => {
    render(
      <SemanticAtlasMap
        status="ready"
        targetMarker={{ id: "target-1", label: "Search hit", x: 1, y: 2 }}
      />,
    );

    expect(screen.getByTestId("atlas-canvas")).toBeTruthy();
    expect(screen.queryByText("No atlas data")).toBeNull();
  });

  it("threads selected and hover stroke theme overrides into point styles", () => {
    const selected = getPointVisualStyle(
      {
        colorKey: "#2563eb",
        hovered: false,
        importance: 1,
        lod: "points",
        pixelWorld: 0.01,
        selected: true,
      },
      {
        fallback: "#64748b",
        hoverStroke: "#00ff00",
        ink: "#0f172a",
        labelHalo: "rgba(0,0,0,0.7)",
        mutedInk: "#475569",
        paper: "#fff",
        selectedStroke: "#ff0000",
      },
    );

    expect(selected.strokeColor).toContain("255, 0, 0");
  });

  it("exposes cluster hit targets to assistive tech", () => {
    render(
      <SemanticAtlasMap
        clusters={[sampleCluster]}
        initialViewport={{ centerX: 0, centerY: 0, zoom: 4.5 }}
        lod="clusters"
        status="ready"
      />,
    );

    // getByRole walks the computed accessibility tree (respects aria-hidden), so
    // this fails if an aria-hidden ancestor ever re-hides the button again —
    // unlike a querySelector, which would still pass on the original bug.
    const hitTarget = screen.getByRole("button", {
      name: "Select cluster: Research",
    });
    expect(hitTarget).toHaveAttribute("tabindex", "0");
  });

  it("activates clusters from the keyboard", () => {
    const onSelectCluster = vi.fn();
    render(
      <SemanticAtlasMap
        clusters={[sampleCluster]}
        initialViewport={{ centerX: 0, centerY: 0, zoom: 4.5 }}
        lod="clusters"
        onSelectCluster={onSelectCluster}
        status="ready"
      />,
    );

    const clusterButton = screen.getByRole("button", {
      name: "Select cluster: Research",
    });
    fireEvent.keyDown(clusterButton, { key: "Enter" });
    fireEvent.keyDown(clusterButton, { key: " " });

    expect(onSelectCluster).toHaveBeenCalledTimes(2);
    expect(onSelectCluster).toHaveBeenLastCalledWith(sampleCluster);
  });
});
