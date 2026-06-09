import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MONOREPO_ROOT = join(PACKAGE_ROOT, "../..");

describe("external atlas consumer fixture", () => {
  it("imports the renderer from the package export instead of repo source", () => {
    const consumer = readFileSync(
      join(MONOREPO_ROOT, "examples/atlas-consumer/src/main.tsx"),
      "utf8",
    );
    const manifest = JSON.parse(
      readFileSync(join(MONOREPO_ROOT, "examples/atlas-consumer/package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(consumer).toContain('from "@catlas/atlas-react"');
    expect(consumer).toContain("SemanticAtlasMap");
    expect(consumer).not.toContain("../../components/atlas");
    expect(manifest.dependencies?.["@catlas/atlas-react"]).toBe("*");
    expect(manifest.devDependencies?.vite).toBeTruthy();
  });

  it("documents workspace build flow for the consumer fixture", () => {
    const manifest = JSON.parse(
      readFileSync(join(MONOREPO_ROOT, "package.json"), "utf8"),
    ) as {
      scripts?: Record<string, string>;
    };

    expect(manifest.scripts?.["example:atlas-consumer:build"]).toContain(
      "examples/atlas-consumer",
    );
    expect(manifest.scripts?.["build:packages"]).toBeTruthy();
  });

  it("documents the external rendered evaluator flow with the package container selector", () => {
    const rootReadme = readFileSync(join(MONOREPO_ROOT, "README.md"), "utf8");
    const fixtureReadme = readFileSync(
      join(MONOREPO_ROOT, "examples/atlas-consumer/README.md"),
      "utf8",
    );

    expect(rootReadme).toContain(
      '--graph-selector=\'[data-testid="atlas-canvas"]\'',
    );
    expect(fixtureReadme).toContain(
      '--graph-selector=\'[data-testid="atlas-canvas"]\'',
    );
    expect(fixtureReadme).toContain("--interaction=wheel-pan");
    expect(fixtureReadme).toContain("--overlay-selector");
  });

  it("defines a minimal React package separate from the example app", () => {
    const manifest = JSON.parse(
      readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      exports?: Record<string, { import?: string; types?: string }>;
      peerDependencies?: Record<string, string>;
    };

    expect(manifest.exports?.["."]?.import).toBe(
      "./dist/components/atlas/index.js",
    );
    expect(manifest.exports?.["."]?.types).toBe(
      "./dist/components/atlas/index.d.ts",
    );
    expect(manifest.peerDependencies?.react).toBeTruthy();
    expect(manifest.dependencies).toBeUndefined();
  });

  it("keeps the public map renderer structurally styled without Tailwind", () => {
    const component = readFileSync(
      join(PACKAGE_ROOT, "src/components/atlas/SemanticAtlasMap.tsx"),
      "utf8",
    );
    const canvas = readFileSync(
      join(PACKAGE_ROOT, "src/components/atlas/AtlasCanvas.tsx"),
      "utf8",
    );

    expect(component).toContain("type CSSProperties");
    expect(component).toContain("rootStyle");
    expect(canvas).toContain("CANVAS_ROOT_BASE_STYLE");
    expect(canvas).toContain("CANVAS_TEXTURE_STYLE");
    expect(canvas).toContain("CANVAS_SVG_STYLE");
  });
});
