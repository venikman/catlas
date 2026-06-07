import { describe, expect, it } from "vitest";
import type { AtlasPoint } from "@/lib/atlas/types";
import { interpolatePointSet } from "@/lib/atlas/rendering/transitions";

function point(entityId: string, x: number, y: number): AtlasPoint {
  return {
    id: `${entityId}-id`,
    entityId,
    viewId: "view",
    viewSlug: "research-domains",
    x,
    y,
    clusterId: "cluster",
    label: entityId,
    entityType: "Paper",
    importance: 0.5,
    payloadSummary: "summary",
    colorKey: "#2563eb",
  };
}

describe("atlas point transitions", () => {
  it("settles to only the next point set at progress 1", () => {
    const previous = [point("same", 0, 0), point("exit", 1, 1)];
    const next = [point("same", 2, 2), point("enter", 3, 3)];

    const settled = interpolatePointSet(previous, next, 1);

    expect(settled.map((item) => item.entityId)).toEqual(["same", "enter"]);
    expect(settled).not.toContainEqual(
      expect.objectContaining({ entityId: "exit", renderOpacity: 0 }),
    );
  });
});
