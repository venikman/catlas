import type { AtlasDensityTile, AtlasPoint } from "../types";

export type RenderedAtlasPoint = AtlasPoint & {
  renderOpacity?: number;
  renderRadius?: number;
};

export type RenderPointBuffer = {
  positions: Float32Array;
  colors: Uint8Array;
  radii: Float32Array;
};

export type DensitySample = {
  id: string;
  x: number;
  y: number;
  weight: number;
  colorKey: string;
  label?: string;
};

export function hexToRgba(hex: string | undefined, alpha = 220): [number, number, number, number] {
  const normalized = (hex ?? "#64748b").replace("#", "");
  const value = normalized.length === 3
    ? normalized
        .split("")
        .map((char) => char + char)
        .join("")
    : normalized.padEnd(6, "0").slice(0, 6);
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    alpha,
  ];
}

export function buildPointBuffers(points: RenderedAtlasPoint[]): RenderPointBuffer {
  const positions = new Float32Array(points.length * 3);
  const colors = new Uint8Array(points.length * 4);
  const radii = new Float32Array(points.length);

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    positions[index * 3] = point.x;
    positions[index * 3 + 1] = point.y;
    positions[index * 3 + 2] = 0;

    const alpha = Math.round(235 * (point.renderOpacity ?? 1));
    const color = hexToRgba(point.colorKey, alpha);
    colors[index * 4] = color[0];
    colors[index * 4 + 1] = color[1];
    colors[index * 4 + 2] = color[2];
    colors[index * 4 + 3] = color[3];

    radii[index] = point.renderRadius ?? 3 + point.importance * 5;
  }

  return { positions, colors, radii };
}

export function densityTilesToSamples(tiles: AtlasDensityTile[]): DensitySample[] {
  return tiles.flatMap((tile) =>
    tile.densityPayload.points.map((point, index) => ({
      id: `${tile.id}-${index}`,
      x: point.x,
      y: point.y,
      weight: point.weight,
      colorKey: tile.densityPayload.colorKey,
      label: tile.densityPayload.label,
    })),
  );
}

export function buildDensityBuffers(samples: DensitySample[]): RenderPointBuffer {
  const positions = new Float32Array(samples.length * 3);
  const colors = new Uint8Array(samples.length * 4);
  const radii = new Float32Array(samples.length);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    positions[index * 3] = sample.x;
    positions[index * 3 + 1] = sample.y;
    positions[index * 3 + 2] = 0;

    const color = hexToRgba(sample.colorKey, 42);
    colors[index * 4] = color[0];
    colors[index * 4 + 1] = color[1];
    colors[index * 4 + 2] = color[2];
    colors[index * 4 + 3] = color[3];

    radii[index] = 26 + sample.weight * 34;
  }

  return { positions, colors, radii };
}
