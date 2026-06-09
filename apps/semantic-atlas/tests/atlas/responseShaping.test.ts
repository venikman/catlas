import { describe, expect, it } from "vitest";
import type {
  AtlasCluster,
  AtlasEntityDetails,
  AtlasPoint,
} from "@/lib/atlas/types";
import {
  isTruncated,
  lightweightCluster,
  lightweightEntity,
  lightweightPoint,
  truncateAtlasLabel,
} from "@/lib/atlas/responseShaping";

function point(overrides: Partial<AtlasPoint> = {}): AtlasPoint {
  return {
    id: "point-1",
    entityId: "entity-1",
    viewId: "view-1",
    viewSlug: "research-domains",
    x: 1.123456,
    y: 2.987654,
    clusterId: "cluster-1",
    label: "A very specific entity label",
    entityType: "Paper",
    importance: 0.8,
    payloadSummary: "large summary should not be in viewport payload",
    metadata: { heavy: true },
    colorKey: "#2563eb",
    ...overrides,
  };
}

describe("atlas response shaping", () => {
  it("strips heavy metadata from viewport points", () => {
    const shaped = lightweightPoint(point());

    expect(shaped.metadata).toBeUndefined();
    expect(shaped.payloadSummary).toBeUndefined();
    expect(shaped.id).toBeUndefined();
    expect(shaped.viewId).toBeUndefined();
    expect(shaped.entityId).toBe("entity-1");
    expect(shaped.x).toBe(1.1235);
    expect(shaped.y).toBe(2.9877);
  });

  it("strips cluster metadata while preserving viewport bounds", () => {
    const cluster: AtlasCluster = {
      id: "cluster-row-1",
      viewId: "view-1",
      viewSlug: "research-domains",
      lodLevel: 1,
      clusterId: "cluster-1",
      label: "Graph Neural Networks",
      centroidX: 1.234567,
      centroidY: -0.345678,
      radius: 2.345678,
      pointCount: 1200,
      importance: 0.82345,
      boundsMinX: -1.234567,
      boundsMaxX: 2.345678,
      boundsMinY: -3.456789,
      boundsMaxY: 4.567891,
      colorKey: "#2563eb",
      metadata: { heavy: true },
    };

    const shaped = lightweightCluster(cluster);

    expect(shaped.metadata).toBeUndefined();
    expect(shaped.centroidX).toBe(1.2346);
    expect(shaped.centroidY).toBe(-0.3457);
    expect(shaped.importance).toBe(0.823);
    expect(shaped.boundsMaxY).toBe(4.5679);
  });

  it("truncates long labels with an ascii suffix", () => {
    const label = "x".repeat(140);

    expect(truncateAtlasLabel(label)).toHaveLength(96);
    expect(truncateAtlasLabel(label).endsWith("...")).toBe(true);
  });

  it("marks full limit responses as possibly truncated", () => {
    expect(isTruncated(5000, 5000)).toBe(true);
    expect(isTruncated(4999, 5000)).toBe(false);
  });
});

function entity(overrides: Partial<AtlasEntityDetails> = {}): AtlasEntityDetails {
  return {
    entityId: "entity-1",
    label: "x".repeat(140),
    entityType: "Paper",
    payloadSummary: "summary text",
    metadata: { safe: "ok", secret: "ssn-123" },
    views: [
      {
        viewId: "view-1",
        viewSlug: "research-domains",
        x: 1.123456,
        y: 2.987654,
        clusterId: "cluster-1",
      },
    ],
    ...overrides,
  };
}

describe("lightweightEntity", () => {
  it("truncates the label and rounds view coordinates", () => {
    const shaped = lightweightEntity(entity());

    expect(shaped.label).toHaveLength(96);
    expect(shaped.views[0].x).toBe(1.1235);
    expect(shaped.views[0].y).toBe(2.9877);
  });

  it("passes metadata and payloadSummary through by default", () => {
    const shaped = lightweightEntity(entity());

    expect(shaped.metadata).toEqual({ safe: "ok", secret: "ssn-123" });
    expect(shaped.payloadSummary).toBe("summary text");
  });

  it("whitelists metadata keys when given an allow-list", () => {
    const shaped = lightweightEntity(entity(), { metadataAllowList: ["safe"] });

    expect(shaped.metadata).toEqual({ safe: "ok" });
    expect(shaped.metadata.secret).toBeUndefined();
  });

  it("drops payloadSummary when includePayloadSummary is false", () => {
    const shaped = lightweightEntity(entity(), { includePayloadSummary: false });

    expect(shaped.payloadSummary).toBe("");
  });

  it("is defensive against a store returning null views/metadata", () => {
    const shaped = lightweightEntity(
      entity({
        views: undefined as unknown as AtlasEntityDetails["views"],
        metadata: undefined as unknown as AtlasEntityDetails["metadata"],
      }),
    );

    expect(shaped.views).toEqual([]);
    expect(shaped.metadata).toEqual({});
  });
});
