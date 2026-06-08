import type { AtlasBbox } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function easeOutCubic(t: number): number {
  const clamped = clamp(t, 0, 1);
  return 1 - Math.pow(1 - clamped, 3);
}

export function bboxContainsPoint(
  bbox: AtlasBbox,
  point: { x: number; y: number },
): boolean {
  return (
    point.x >= bbox.minX &&
    point.x <= bbox.maxX &&
    point.y >= bbox.minY &&
    point.y <= bbox.maxY
  );
}

export function bboxIntersects(a: AtlasBbox, b: AtlasBbox): boolean {
  return !(
    a.maxX < b.minX ||
    a.minX > b.maxX ||
    a.maxY < b.minY ||
    a.minY > b.maxY
  );
}

export function expandBbox(bbox: AtlasBbox, factor: number): AtlasBbox {
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  const dx = (width * factor - width) / 2;
  const dy = (height * factor - height) / 2;
  return {
    minX: bbox.minX - dx,
    maxX: bbox.maxX + dx,
    minY: bbox.minY - dy,
    maxY: bbox.maxY + dy,
  };
}

export function worldToScreen(
  point: { x: number; y: number },
  bbox: AtlasBbox,
  size: { width: number; height: number },
): { x: number; y: number } {
  const x = ((point.x - bbox.minX) / (bbox.maxX - bbox.minX)) * size.width;
  const y = size.height - ((point.y - bbox.minY) / (bbox.maxY - bbox.minY)) * size.height;
  return { x, y };
}

export function screenToWorld(
  point: { x: number; y: number },
  bbox: AtlasBbox,
  size: { width: number; height: number },
): { x: number; y: number } {
  const x = bbox.minX + (point.x / size.width) * (bbox.maxX - bbox.minX);
  const y = bbox.minY + ((size.height - point.y) / size.height) * (bbox.maxY - bbox.minY);
  return { x, y };
}
