# Catlas Codebase Review — Overengineering & AI Slop

**Scope:** All source in `packages/atlas-react`, `packages/ui-graph-evaluator`, `packages/atlas-benchmarks`. ~10,870 LOC across packages.

**Note:** Reviewed against `main` at `8959610` (includes #17, #18, #19, #22). The duplicate `./contract` export (#18) and dead benchmark `quick` script (#17) were already fixed. Contract is now at v0.2.0 with `isAvailable?()`. CI gate added in #22.

---

## 1. AtlasCanvas.tsx — 1,837 lines, One File

This is the dominant issue. One component file is 44% of the entire `atlas-react` package.

### 1.1 The stipple code is copy-paste-with-tweaks (lines 319–728)

Two functions — `buildDensityRegions` and `buildDensityStipple` — contain this pattern. The group-accumulate-centroid-spread pattern appears three times verbatim (once in `buildDensityRegions` and twice in `buildDensityStipple`):

```ts
// This block appears 3 times (lines 323-362, 439-493, 615-635)
const groups = new Map<string, { colorKey; samples; score; weight; weightedX; weightedY }>();
for (const sample of samples) {
  const weight = Math.max(sample.weight, 0.01);
  group.score += weight; group.weight += weight;
  group.weightedX += sample.x * weight; group.weightedY += sample.y * weight;
}
const centerX = group.weightedX / group.weight;
const spread = group.samples.reduce(...) / group.weight;
```

A single `groupByLabel(samples) → { center, spread, samples }[]` helper would eliminate ~120 lines.

### 1.2 Magic numbers everywhere

The file has ~80+ bare numeric literals with no name or comment. Examples:

- `0.11`, `0.055`, `0.038` (wobble harmonics, line 307-308)
- `216000`, `34000`, `14000`, `56000`, `36000` (stipple budgets, lines 496-504)
- `7800`, `1040`, `56`, `310` (per-group stipple counts, line 552)
- `0.32`, `0.26`, `0.24`, `0.08` (noise/blend/opacity constants scattered everywhere)
- `68`, `15`, `58`, `240` (pixel-world radius constants, line 367-369)

Some of these are tuned visual parameters, but they're unnamed and untraceable. Compare with `ATLAS_VISUAL_CONFIG` which names its values — the stipple code predates that discipline.

### 1.3 AtlasCanvas should be split

The file contains at least 5 separable concerns:
1. **Stipple/texture generation** (~400 lines) — pure functions, no React dependency
2. **Contour/branch path building** (~80 lines) — pure geometry
3. **Canvas 2D rendering** (the big `useEffect`, ~170 lines) — rendering pipeline
4. **SVG overlay** (~250 lines of JSX) — cluster bubbles, labels, regions, markers
5. **Interaction handlers** (pan/zoom/hover/click, ~180 lines)

Extracting the pure functions alone would cut the file in half and make them testable.

---

## 2. Duplicated Utilities

### 2.1 `clamp` vs `clampNumber` — identical function, two names

- `math.ts:3` exports `clamp(value, min, max)` 
- `AtlasCanvas.tsx:197` defines local `clampNumber(value, min, max)` — identical body

`clampNumber` is used 16 times in AtlasCanvas. It should just import `clamp`.

### 2.2 `smoothstep` — duplicated in two files

- `layerOpacity.ts:16` — local `smoothstep`
- `visualConfig.ts:241` — local `smoothstep`

Identical function, should be in `math.ts`.

### 2.3 `hexToRgba` vs `rgbaCssFromHex` — near-identical hex parsers

- `buffers.ts:23` — `hexToRgba(hex, alpha)` → `[r, g, b, a]` tuple
- `visualConfig.ts:220` — `rgbaCssFromHex(hex, alpha, palette)` → `"rgba(r, g, b, a)"` string

Same hex parsing logic duplicated. One should call the other.

### 2.4 `worldToScreen` / `screenToWorld` vs `projectWorldPoint` / `unprojectScreenPoint`

- `math.ts:50-67` — exported `worldToScreen` and `screenToWorld`
- `AtlasCanvas.tsx:251-273` — local `projectWorldPoint` and `unprojectScreenPoint`

Different signatures (math.ts uses `{ size, bbox }`, AtlasCanvas uses `{ transform, bbox }`) but similar intent. **Both math.ts exports are unused** — nothing imports them anywhere in the monorepo. Dead code.

### 2.5 `AtlasTargetMarker` — type defined twice

- `SemanticAtlasMap.tsx:37-42` — `type AtlasTargetMarker = { id; label?; x; y }`
- `AtlasCanvas.tsx:49-54` — identical definition

Should be in a shared types file.

---

## 3. Dead / Unused Code

### 3.1 `buildPointBuffers` and `buildDensityBuffers` in buffers.ts

These create `Float32Array`/`Uint8Array` typed array buffers (lines 39-61, 76-97) as if preparing for WebGL rendering. **Nothing imports them.** The actual renderer uses Canvas 2D. These are dead code — either remnants of a planned WebGL path or speculative generalization. The `RenderPointBuffer` type is also unused outside the file.

### 3.2 `worldToScreen` and `screenToWorld` in math.ts

As noted above — exported, never imported.

### 3.3 `componentTypes.ts` — unnecessary re-export wrapper

`lib/atlas/componentTypes.ts` is 5 lines defining `AtlasViewportState = { centerX; centerY; zoom }`. Then `components/atlas/atlasComponentTypes.ts` imports and re-exports it as:
```ts
export type AtlasViewportState = BaseAtlasViewportState;
```
There's no transformation. Two files for a 3-field type alias.

---

## 4. AI Slop Indicators

### 4.1 Over-verbose JSDoc comments on obvious code

`atlasStore.ts` comments are well-written and add real context (locked decisions, adoption contract). But `atlasValidation.ts` has zero comments on 399 lines of repetitive field-validation — 8 near-identical `validateX` functions each calling the same `stringField`/`finiteNumberField`/`nonNegative` helpers. The code is clear enough, but the structural repetitiveness is classic generated code.

### 4.2 The stipple generation reads like tuned-by-iteration-not-design

Constants like `0.045`, `0.068`, `0.078` appear without rationale. The lobe-scattering code in `buildDensityStipple` (lines 522-549) has 11 magic numbers in 27 lines. This pattern — dense numeric tuning scattered across a long function — is characteristic of AI-generated visual code where parameters were adjusted by regeneration rather than by extracting named constants.

### 4.3 Redundant comment-the-diff style

Some doc comments describe what was changed rather than why the code exists:

- `atlasStore.ts:100-103` — "Resolves the round-2 disagreement (README snippets used different graph selectors...)" — this is diff context, not API documentation. Good for a commit message, wrong place for a source comment.

### 4.4 Over-elaborate validation module

`atlasValidation.ts` (399 lines) is a hand-rolled runtime schema validator. For a contract with 3 entity types, this is a lot of code to validate shapes that TypeScript already types. The value is for runtime validation of untrusted API data, but the same result could be achieved with ~50 lines using Zod or a similar library (which the project doesn't use, so this is a judgment call). Not "slop" exactly, but the line count is disproportionate to the value.

---

## 5. Overengineering

### 5.1 Benchmark framework is heavy relative to what it validates

`atlas-benchmarks` has 12 validator files, 3 reporter files, a scenarios engine, a budget config with env-var overrides, SOTA/good dual tiers, and a findings system. For a package that's currently validating a single reference app. The `sourceInvariantValidator.ts` literally greps source files with regex to check architectural invariants — impressive but fragile.

The `BUDGETS` object has a dual-tier system (ATLAS_BUDGETS with `good`/`sota` thresholds → BUDGETS compatibility layer with env overrides). This adds cognitive overhead for what amounts to ~20 threshold values.

### 5.2 UI evaluator is 911 lines in one file

`run-ui-evaluator.ts` is a complete Playwright-based visual testing tool in a single file: CLI arg parsing, browser launch, interaction simulation, image texture analysis (pixel sampling in browser via `page.evaluate`), reference image comparison, and JSON/Markdown reporting. It works, but it's doing 6 jobs in one function.

### 5.3 The LOD blend/opacity system has 3 layers of indirection

1. `lod.ts` — `getLodForZoom()` returns the active LOD layer
2. `layerOpacity.ts` — `getAtlasLayerOpacities()` returns 9 opacity channels with smoothstep crossfading
3. `visualConfig.ts` — `getLodBlend()` returns a different 3-channel LOD blend also using smoothstep

Two different smoothstep-based LOD blending systems coexist. `getLodBlend` in visualConfig.ts uses a `lodCrossfadeWindow` of `0.42`; `getAtlasLayerOpacities` in layerOpacity.ts hardcodes different windows (`0.5`, `0.55`, `0.65`). These compute overlapping information but aren't connected.

### 5.4 `atlasStableId` is cute but unnecessary

```ts
function atlasStableId(prefix: string, parts: Array<number | string>): string {
  return [prefix, ...parts.map(part => `${String(part).length}:${String(part)}`)].join("|");
}
```
This generates IDs like `cluster|10:golden-view|15:language-models|1:1`. The length-prefix encoding prevents ambiguity for ids containing `|`, but nothing in the system uses `|` in view/cluster IDs. A simple `${prefix}-${parts.join("-")}` would suffice.

---

## 6. Things That Are Actually Good

- **`AtlasStore` interface** — clean, minimal, well-commented. The 7-method contract is the right abstraction for the modular boundary.
- **`SemanticAtlasMap.tsx`** — well-structured controlled/uncontrolled component pattern. The dev-mode warning for controlled viewport without `onViewportChange` is a nice touch.
- **`visualConfig.ts` constant structure** — `ATLAS_VISUAL_CONFIG` organizes ~60 visual parameters into named groups. This is how the stipple code should work.
- **LOD system design** — the three-tier density/clusters/points model with zoom-based switching is architecturally sound.
- **`atlasAggregation.ts`** — `aggregateClusters` and `buildDensityTiles` are clean, well-tested (fixtures prove them), and correctly handle edge cases (empty input, world bounds validation, stable sorting).
- **Benchmark validators** — despite the framework weight, individual validators (`scaleValidator`, `lodValidator`, `sourceInvariantValidator`) make concrete, measurable assertions. The check/pass/warn/fail/skip helpers are well-designed.
- **Canvas 2D rendering** — choosing Canvas 2D over SVG for points and stipple was the correct performance decision for the data scale.

---

## 7. Recommendations — Prioritized

### P0 — Reduce before anyone else touches this code
1. **Split AtlasCanvas.tsx.** Extract stipple generators, path builders, and canvas rendering into separate files. Target: AtlasCanvas.tsx < 600 lines.
2. **Deduplicate `clamp`/`clampNumber`, `smoothstep`, `hexToRgba`/`rgbaCssFromHex`.** Import from `math.ts` or `visualConfig.ts`. 
3. **Delete dead code:** `buildPointBuffers`, `buildDensityBuffers`, `RenderPointBuffer`, `worldToScreen`, `screenToWorld`.
4. **Share `AtlasTargetMarker` type** — define once, import in both components.

### P1 — Reduce magic numbers
5. **Extract stipple constants** into a `STIPPLE_CONFIG` section in `ATLAS_VISUAL_CONFIG` (or a dedicated config). Name the 80+ magic numbers.
6. **Extract the group-by-label-weighted-centroid** pattern into a shared utility. Used 3+ times.

### P2 — Simplify indirection
7. **Merge the two LOD blend systems** (`getLodBlend` and `getAtlasLayerOpacities`). One should subsume the other.
8. **Merge `componentTypes.ts` into `atlasComponentTypes.ts`** — the re-export wrapper adds no value.
9. **Consider Zod** for `atlasValidation.ts` if the project adds it as a dependency elsewhere — would cut ~300 lines to ~50.

---

## Summary

The codebase has a well-designed core architecture (AtlasStore contract, LOD model, visual config). The main problems are concentrated in **AtlasCanvas.tsx** — a 1,837-line file with heavy copy-paste in the stipple generation, ~80 unnamed magic numbers, and 5 separable concerns in one component. There are also ~6 duplicated utilities across files and ~100 lines of dead code.

The benchmark tooling is comprehensive but heavy for its current scope. The contract and aggregation modules are clean.

The AI slop signal is moderate: repetitive validation code, unnamed visual constants tuned by iteration, and diff-context comments that belong in commit messages. It's not egregious — the code works and the types are correct — but the stipple/texture code has the "generate and tweak" fingerprint of AI-assisted visual tuning.
