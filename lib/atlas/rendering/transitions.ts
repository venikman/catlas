import { easeOutCubic, lerp } from "../math";
import type { AtlasPoint } from "../types";
import type { RenderedAtlasPoint } from "./buffers";

export function interpolatePointSet(
  previous: AtlasPoint[],
  next: AtlasPoint[],
  progress: number,
): RenderedAtlasPoint[] {
  const eased = easeOutCubic(progress);
  const previousByEntity = new Map(previous.map((point) => [point.entityId, point]));
  const nextByEntity = new Set(next.map((point) => point.entityId));

  const entering = next.map((point) => {
    const from = previousByEntity.get(point.entityId);
    if (!from) {
      return {
        ...point,
        renderOpacity: eased,
        renderRadius: (3 + point.importance * 5) * (0.72 + eased * 0.28),
      };
    }

    return {
      ...point,
      x: Number(lerp(from.x, point.x, eased).toFixed(5)),
      y: Number(lerp(from.y, point.y, eased).toFixed(5)),
      renderOpacity: 1,
    };
  });

  const exiting = previous
    .filter((point) => !nextByEntity.has(point.entityId))
    .slice(0, 1400)
    .map((point) => ({
      ...point,
      renderOpacity: 1 - eased,
      renderRadius: (3 + point.importance * 5) * (1 - eased * 0.45),
    }));

  return [...entering, ...exiting];
}
