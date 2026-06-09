import type { AtlasWorldBounds } from "./atlasStore";
import { ATLAS_DEFAULT_WORLD_BOUNDS } from "./atlasStore";
import type {
  AtlasCluster,
  AtlasDensityTile,
  AtlasPoint,
} from "../lib/atlas/types";

export type AtlasContractRows = {
  worldBounds?: AtlasWorldBounds;
  points?: AtlasPoint[];
  clusters?: AtlasCluster[];
  densityTiles?: AtlasDensityTile[];
};

export type AtlasContractValidationIssue = {
  path: string;
  message: string;
};

export type AtlasContractValidationResult = {
  ok: boolean;
  issues: AtlasContractValidationIssue[];
};

export type AtlasContractValidationOptions = {
  worldBounds?: AtlasWorldBounds;
  requireInBounds?: boolean;
};

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function addIssue(
  issues: AtlasContractValidationIssue[],
  path: string,
  message: string,
): void {
  issues.push({ path, message });
}

function stringField(
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: AtlasContractValidationIssue[],
): string | undefined {
  const value = input[key];
  if (typeof value === "string" && value.trim().length > 0) return value;
  addIssue(issues, `${path}.${key}`, "must be a non-empty string");
  return undefined;
}

function optionalStringField(
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: AtlasContractValidationIssue[],
): string | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  addIssue(issues, `${path}.${key}`, "must be a string when provided");
  return undefined;
}

function finiteNumberField(
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: AtlasContractValidationIssue[],
): number | undefined {
  const value = input[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  addIssue(issues, `${path}.${key}`, "must be a finite number");
  return undefined;
}

function integerField(
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: AtlasContractValidationIssue[],
): number | undefined {
  const value = finiteNumberField(input, key, path, issues);
  if (value === undefined) return undefined;
  if (Number.isInteger(value)) return value;
  addIssue(issues, `${path}.${key}`, "must be an integer");
  return undefined;
}

function nonNegative(
  value: number | undefined,
  path: string,
  issues: AtlasContractValidationIssue[],
): void {
  if (value !== undefined && value < 0) {
    addIssue(issues, path, "must be non-negative");
  }
}

function inBounds(
  value: number | undefined,
  min: number,
  max: number,
  path: string,
  issues: AtlasContractValidationIssue[],
): void {
  if (value === undefined) return;
  if (value < min || value > max) {
    addIssue(issues, path, `must be within [${min}, ${max}]`);
  }
}

function validateBoundsShape(
  input: unknown,
  path: string,
  issues: AtlasContractValidationIssue[],
): AtlasWorldBounds | undefined {
  if (!isRecord(input)) {
    addIssue(issues, path, "must be an object");
    return undefined;
  }

  const minX = finiteNumberField(input, "minX", path, issues);
  const maxX = finiteNumberField(input, "maxX", path, issues);
  const minY = finiteNumberField(input, "minY", path, issues);
  const maxY = finiteNumberField(input, "maxY", path, issues);
  if (
    minX !== undefined &&
    maxX !== undefined &&
    minY !== undefined &&
    maxY !== undefined
  ) {
    if (minX >= maxX) addIssue(issues, `${path}.minX`, "must be less than maxX");
    if (minY >= maxY) addIssue(issues, `${path}.minY`, "must be less than maxY");
    return { minX, maxX, minY, maxY };
  }

  return undefined;
}

function validateAtlasPointValue(
  input: unknown,
  path: string,
  worldBounds: AtlasWorldBounds,
  requireInBounds: boolean,
  issues: AtlasContractValidationIssue[],
): void {
  if (!isRecord(input)) {
    addIssue(issues, path, "must be an object");
    return;
  }

  stringField(input, "entityId", path, issues);
  optionalStringField(input, "id", path, issues);
  optionalStringField(input, "viewId", path, issues);
  optionalStringField(input, "viewSlug", path, issues);
  stringField(input, "clusterId", path, issues);
  stringField(input, "label", path, issues);
  stringField(input, "entityType", path, issues);
  optionalStringField(input, "colorKey", path, issues);
  const x = finiteNumberField(input, "x", path, issues);
  const y = finiteNumberField(input, "y", path, issues);
  const importance = finiteNumberField(input, "importance", path, issues);
  nonNegative(importance, `${path}.importance`, issues);

  if (requireInBounds) {
    inBounds(x, worldBounds.minX, worldBounds.maxX, `${path}.x`, issues);
    inBounds(y, worldBounds.minY, worldBounds.maxY, `${path}.y`, issues);
  }
}

function validateAtlasClusterValue(
  input: unknown,
  path: string,
  worldBounds: AtlasWorldBounds,
  requireInBounds: boolean,
  issues: AtlasContractValidationIssue[],
): void {
  if (!isRecord(input)) {
    addIssue(issues, path, "must be an object");
    return;
  }

  stringField(input, "id", path, issues);
  stringField(input, "viewId", path, issues);
  optionalStringField(input, "viewSlug", path, issues);
  stringField(input, "clusterId", path, issues);
  stringField(input, "label", path, issues);
  stringField(input, "colorKey", path, issues);
  const lodLevel = integerField(input, "lodLevel", path, issues);
  const centroidX = finiteNumberField(input, "centroidX", path, issues);
  const centroidY = finiteNumberField(input, "centroidY", path, issues);
  const radius = finiteNumberField(input, "radius", path, issues);
  const pointCount = integerField(input, "pointCount", path, issues);
  const importance = finiteNumberField(input, "importance", path, issues);
  const boundsMinX = finiteNumberField(input, "boundsMinX", path, issues);
  const boundsMaxX = finiteNumberField(input, "boundsMaxX", path, issues);
  const boundsMinY = finiteNumberField(input, "boundsMinY", path, issues);
  const boundsMaxY = finiteNumberField(input, "boundsMaxY", path, issues);

  nonNegative(lodLevel, `${path}.lodLevel`, issues);
  nonNegative(radius, `${path}.radius`, issues);
  nonNegative(pointCount, `${path}.pointCount`, issues);
  nonNegative(importance, `${path}.importance`, issues);
  if (
    boundsMinX !== undefined &&
    boundsMaxX !== undefined &&
    boundsMinX > boundsMaxX
  ) {
    addIssue(issues, `${path}.boundsMinX`, "must be less than or equal to boundsMaxX");
  }
  if (
    boundsMinY !== undefined &&
    boundsMaxY !== undefined &&
    boundsMinY > boundsMaxY
  ) {
    addIssue(issues, `${path}.boundsMinY`, "must be less than or equal to boundsMaxY");
  }

  if (requireInBounds) {
    inBounds(centroidX, worldBounds.minX, worldBounds.maxX, `${path}.centroidX`, issues);
    inBounds(centroidY, worldBounds.minY, worldBounds.maxY, `${path}.centroidY`, issues);
    inBounds(boundsMinX, worldBounds.minX, worldBounds.maxX, `${path}.boundsMinX`, issues);
    inBounds(boundsMaxX, worldBounds.minX, worldBounds.maxX, `${path}.boundsMaxX`, issues);
    inBounds(boundsMinY, worldBounds.minY, worldBounds.maxY, `${path}.boundsMinY`, issues);
    inBounds(boundsMaxY, worldBounds.minY, worldBounds.maxY, `${path}.boundsMaxY`, issues);
  }
}

function validateAtlasDensityTileValue(
  input: unknown,
  path: string,
  worldBounds: AtlasWorldBounds,
  requireInBounds: boolean,
  issues: AtlasContractValidationIssue[],
): void {
  if (!isRecord(input)) {
    addIssue(issues, path, "must be an object");
    return;
  }

  stringField(input, "id", path, issues);
  stringField(input, "viewId", path, issues);
  optionalStringField(input, "viewSlug", path, issues);
  const z = integerField(input, "z", path, issues);
  const xTile = integerField(input, "xTile", path, issues);
  const yTile = integerField(input, "yTile", path, issues);
  const pointCount = integerField(input, "pointCount", path, issues);
  nonNegative(z, `${path}.z`, issues);
  nonNegative(xTile, `${path}.xTile`, issues);
  nonNegative(yTile, `${path}.yTile`, issues);
  nonNegative(pointCount, `${path}.pointCount`, issues);

  const bounds = validateBoundsShape(input.bounds, `${path}.bounds`, issues);
  if (requireInBounds && bounds) {
    inBounds(bounds.minX, worldBounds.minX, worldBounds.maxX, `${path}.bounds.minX`, issues);
    inBounds(bounds.maxX, worldBounds.minX, worldBounds.maxX, `${path}.bounds.maxX`, issues);
    inBounds(bounds.minY, worldBounds.minY, worldBounds.maxY, `${path}.bounds.minY`, issues);
    inBounds(bounds.maxY, worldBounds.minY, worldBounds.maxY, `${path}.bounds.maxY`, issues);
  }

  if (!isRecord(input.densityPayload)) {
    addIssue(issues, `${path}.densityPayload`, "must be an object");
    return;
  }

  stringField(input.densityPayload, "colorKey", `${path}.densityPayload`, issues);
  optionalStringField(input.densityPayload, "label", `${path}.densityPayload`, issues);
  if (!Array.isArray(input.densityPayload.points)) {
    addIssue(issues, `${path}.densityPayload.points`, "must be an array");
    return;
  }

  input.densityPayload.points.forEach((point, index) => {
    const pointPath = `${path}.densityPayload.points[${index}]`;
    if (!isRecord(point)) {
      addIssue(issues, pointPath, "must be an object");
      return;
    }
    const x = finiteNumberField(point, "x", pointPath, issues);
    const y = finiteNumberField(point, "y", pointPath, issues);
    const weight = finiteNumberField(point, "weight", pointPath, issues);
    nonNegative(weight, `${pointPath}.weight`, issues);
    if (requireInBounds) {
      inBounds(x, worldBounds.minX, worldBounds.maxX, `${pointPath}.x`, issues);
      inBounds(y, worldBounds.minY, worldBounds.maxY, `${pointPath}.y`, issues);
    }
  });
}

export function validateAtlasWorldBounds(
  input: unknown,
): AtlasContractValidationResult {
  const issues: AtlasContractValidationIssue[] = [];
  validateBoundsShape(input, "worldBounds", issues);
  return { ok: issues.length === 0, issues };
}

export function validateAtlasPoint(
  input: unknown,
  options: AtlasContractValidationOptions | null = {},
): AtlasContractValidationResult {
  const issues: AtlasContractValidationIssue[] = [];
  validateAtlasPointValue(
    input,
    "point",
    options?.worldBounds ?? ATLAS_DEFAULT_WORLD_BOUNDS,
    options?.requireInBounds ?? true,
    issues,
  );
  return { ok: issues.length === 0, issues };
}

export function validateAtlasCluster(
  input: unknown,
  options: AtlasContractValidationOptions | null = {},
): AtlasContractValidationResult {
  const issues: AtlasContractValidationIssue[] = [];
  validateAtlasClusterValue(
    input,
    "cluster",
    options?.worldBounds ?? ATLAS_DEFAULT_WORLD_BOUNDS,
    options?.requireInBounds ?? true,
    issues,
  );
  return { ok: issues.length === 0, issues };
}

export function validateAtlasDensityTile(
  input: unknown,
  options: AtlasContractValidationOptions | null = {},
): AtlasContractValidationResult {
  const issues: AtlasContractValidationIssue[] = [];
  validateAtlasDensityTileValue(
    input,
    "densityTile",
    options?.worldBounds ?? ATLAS_DEFAULT_WORLD_BOUNDS,
    options?.requireInBounds ?? true,
    issues,
  );
  return { ok: issues.length === 0, issues };
}

export function validateAtlasContractRows(
  rows: AtlasContractRows | null | undefined,
  options: AtlasContractValidationOptions | null = {},
): AtlasContractValidationResult {
  const issues: AtlasContractValidationIssue[] = [];
  if (!isRecord(rows)) {
    addIssue(issues, "rows", "must be an object");
    return { ok: false, issues };
  }

  const worldBounds =
    rows.worldBounds ?? options?.worldBounds ?? ATLAS_DEFAULT_WORLD_BOUNDS;
  const requireInBounds = options?.requireInBounds ?? true;

  const validatedBounds =
    validateBoundsShape(worldBounds, "worldBounds", issues) ??
    ATLAS_DEFAULT_WORLD_BOUNDS;

  const collections = [
    ["points", rows.points, validateAtlasPointValue],
    ["clusters", rows.clusters, validateAtlasClusterValue],
    ["densityTiles", rows.densityTiles, validateAtlasDensityTileValue],
  ] as const;

  for (const [name, values, validator] of collections) {
    if (values === undefined) continue;
    if (!Array.isArray(values)) {
      addIssue(issues, name, "must be an array");
      continue;
    }
    values.forEach((value, index) => {
      validator(value, `${name}[${index}]`, validatedBounds, requireInBounds, issues);
    });
  }

  return { ok: issues.length === 0, issues };
}

export function formatAtlasContractIssues(
  issues: AtlasContractValidationIssue[],
): string {
  return issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n");
}

export function assertAtlasContractRows(
  rows: AtlasContractRows | null | undefined,
  options: AtlasContractValidationOptions | null = {},
): void {
  const result = validateAtlasContractRows(rows, options);
  if (!result.ok) {
    throw new Error(formatAtlasContractIssues(result.issues));
  }
}
