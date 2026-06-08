# @catlas/ui-graph-evaluator

Portable CLI evaluator for canvas and SVG graph UIs.

It is intentionally graph-tool agnostic. Point it at a URL, a root selector, and a graph selector; it checks page load, graph bounds, nonblank rendering, sampled texture coverage, sampled color variation, sampled spatial texture, pan/zoom interaction, optional overlay persistence, console health, and optional screenshot/video artifacts. The graph selector can target a canvas, SVG, or a layered container element; containers are inspected through a graph-element screenshot fallback.

## Usage

```bash
npx @catlas/ui-graph-evaluator \
  --url=http://localhost:4173 \
  --root-selector='[data-testid="graph-root"]' \
  --graph-selector='canvas, svg' \
  --gate
```

For visual evidence:

```bash
npx @catlas/ui-graph-evaluator \
  --url=http://localhost:4173 \
  --graph-selector='canvas' \
  --interaction=wheel-pan \
  --artifacts \
  --record-video
```

For graph labels or overlays that should persist through interaction:

```bash
npx @catlas/ui-graph-evaluator \
  --url=http://localhost:4173 \
  --graph-selector='canvas' \
  --overlay-selector='svg text' \
  --interaction=wheel-pan \
  --min-overlay-count=3 \
  --gate
```

For stricter dense-map checks:

```bash
npx @catlas/ui-graph-evaluator \
  --url=http://localhost:4173 \
  --graph-selector='canvas' \
  --interaction=wheel-pan \
  --strict-texture \
  --min-coverage=0.04 \
  --min-hue-buckets=5 \
  --min-occupied-cells=120 \
  --gate
```

For texture similarity against a visual reference, pass a local path or image URL:

```bash
npx @catlas/ui-graph-evaluator \
  --url=http://localhost:4173 \
  --graph-selector='canvas' \
  --reference-image=./reference-map.png \
  --min-reference-score=55 \
  --gate
```

Reference comparison is background-relative, so light paper/off-white map backgrounds do not count as dense texture by themselves. Add `--strict-reference` when a reference-score miss should fail the gate instead of warning.

Run `ui-graph-evaluator --help` for the full CLI contract.

## Report

The evaluator writes `ui-evaluator-latest.json` in `benchmarks/results` by default. Use `--results-dir` and `--artifacts-dir` when running it outside this repository.

Texture thresholds are warning-level by default so sparse, monochrome, or line-heavy graph UIs can still use the evaluator. Add `--strict-texture` when you want dense-map texture misses to fail the gate.

Reference-image thresholds are also warning-level by default. The JSON report includes the selected graph screenshot path when artifacts are enabled plus the computed reference score detail in the checks list.
