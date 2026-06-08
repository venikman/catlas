import type { BenchmarkValidator } from "../types";
import { apiValidator } from "./apiValidator";
import { dbQueryValidator } from "./dbQueryValidator";
import { interactionValidator } from "./interactionValidator";
import { lodValidator } from "./lodValidator";
import { memoryValidator } from "./memoryValidator";
import { payloadValidator } from "./payloadValidator";
import { renderValidator } from "./renderValidator";
import { scaleValidator } from "./scaleValidator";
import { searchValidator } from "./searchValidator";
import { sourceInvariantValidator } from "./sourceInvariantValidator";

export const VALIDATORS: Record<string, BenchmarkValidator> = {
  api: apiValidator,
  dbQuery: dbQueryValidator,
  interaction: interactionValidator,
  lod: lodValidator,
  memory: memoryValidator,
  payload: payloadValidator,
  render: renderValidator,
  scale: scaleValidator,
  search: searchValidator,
  sourceInvariant: sourceInvariantValidator,
};
