import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MONOREPO_ROOT = join(PACKAGE_ROOT, "../..");

describe("generic UI graph evaluator", () => {
  it("accepts external URL and selector inputs instead of hardcoding atlas APIs", () => {
    const evaluator = readFileSync(
      join(PACKAGE_ROOT, "src/run-ui-evaluator.ts"),
      "utf8",
    );

    expect(evaluator).toContain('arg("url"');
    expect(evaluator).toContain("root-selector");
    expect(evaluator).toContain("graph-selector");
    expect(evaluator).toContain("UI_EVAL_URL");
    expect(evaluator).toContain("UI_EVAL_BROWSER_EXECUTABLE");
    expect(evaluator).not.toContain("/api/atlas/");
  });

  it("checks visible graph rendering, interaction, and console health", () => {
    const evaluator = readFileSync(
      join(PACKAGE_ROOT, "src/run-ui-evaluator.ts"),
      "utf8",
    );

    expect(evaluator).toContain("Graph texture is nonblank");
    expect(evaluator).toContain("Graph texture coverage measured");
    expect(evaluator).toContain("Graph screenshot texture is nonblank");
    expect(evaluator).toContain("Graph screenshot texture coverage measured");
    expect(evaluator).toContain("Graph color variation measured");
    expect(evaluator).toContain("Graph spatial texture measured");
    expect(evaluator).toContain("Graph interaction changes view");
    expect(evaluator).toContain("Graph overlay exists");
    expect(evaluator).toContain("Graph overlay persists");
    expect(evaluator).toContain("Console health");
    expect(evaluator).toContain("ui-evaluator-latest.json");
  });

  it("can write reusable screenshot and video artifacts", () => {
    const evaluator = readFileSync(
      join(PACKAGE_ROOT, "src/run-ui-evaluator.ts"),
      "utf8",
    );

    expect(evaluator).toContain('arg("artifacts-dir"');
    expect(evaluator).toContain('flag("record-video")');
    expect(evaluator).toContain("before.png");
    expect(evaluator).toContain("after.png");
    expect(evaluator).toContain("interaction.webm");
  });

  it("documents help and configurable texture thresholds", () => {
    const evaluator = readFileSync(
      join(PACKAGE_ROOT, "src/run-ui-evaluator.ts"),
      "utf8",
    );

    expect(evaluator).toContain("UI graph evaluator");
    expect(evaluator).toContain("strict-texture");
    expect(evaluator).toContain("min-coverage");
    expect(evaluator).toContain("min-hue-buckets");
    expect(evaluator).toContain("min-occupied-cells");
    expect(evaluator).toContain("min-overlay-count");
    expect(evaluator).toContain("wheel-pan");
    expect(evaluator).toContain("pan-pixels");
    expect(evaluator).toContain("overlay-selector");
    expect(evaluator).toContain("thresholds");
  });

  it("supports portable reference-image texture comparison", () => {
    const evaluator = readFileSync(
      join(PACKAGE_ROOT, "src/run-ui-evaluator.ts"),
      "utf8",
    );
    const packageReadme = readFileSync(join(PACKAGE_ROOT, "README.md"), "utf8");

    expect(evaluator).toContain("reference-image");
    expect(evaluator).toContain("min-reference-score");
    expect(evaluator).toContain("strict-reference");
    expect(evaluator).toContain("Graph reference texture similarity");
    expect(evaluator).toContain("background-relative");
    expect(evaluator).toContain("graph-before.png");
    expect(packageReadme).toContain("--reference-image=./reference-map.png");
    expect(packageReadme).toContain("--strict-reference");
  });

  it("defines package bins and build scripts for the evaluator", () => {
    const packageManifest = JSON.parse(
      readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"),
    ) as {
      bin?: Record<string, string>;
      dependencies?: Record<string, string>;
      exports?: Record<string, { import?: string; types?: string }>;
      scripts?: Record<string, string>;
    };

    expect(packageManifest.bin?.["ui-graph-evaluator"]).toBe(
      "dist/run-ui-evaluator.js",
    );
    expect(packageManifest.exports?.["."]?.import).toBe(
      "./dist/run-ui-evaluator.js",
    );
    expect(packageManifest.exports?.["."]?.types).toBe(
      "./dist/run-ui-evaluator.d.ts",
    );
    expect(packageManifest.dependencies?.playwright).toBeTruthy();
    expect(packageManifest.scripts?.build).toContain("tsc");
  });
});
