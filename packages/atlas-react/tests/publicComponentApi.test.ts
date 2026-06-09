import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("public atlas component api", () => {
  it("exports a reusable renderer component without app data fetching", () => {
    const component = readFileSync(
      join(PACKAGE_ROOT, "src/components/atlas/SemanticAtlasMap.tsx"),
      "utf8",
    );
    const barrel = readFileSync(join(PACKAGE_ROOT, "src/components/atlas/index.ts"), "utf8");

    expect(component).toContain("export function SemanticAtlasMap");
    expect(component).toContain("export type SemanticAtlasMapProps");
    expect(component).toContain("bboxForViewport");
    expect(barrel).toContain("SemanticAtlasMap");
    expect(barrel).toContain("ATLAS_SELECTORS");
    expect(barrel).not.toContain("AtlasViewer");
    expect(component).not.toContain("fetchAtlasViews");
    expect(component).not.toContain("useQuery");
  });

  it("defines package exports for the renderer barrel", () => {
    const manifest = JSON.parse(
      readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"),
    ) as {
      exports?: Record<string, { import?: string; types?: string }>;
    };

    expect(manifest.exports?.["."]?.import).toBe(
      "./dist/components/atlas/index.js",
    );
    expect(manifest.exports?.["."]?.types).toBe(
      "./dist/components/atlas/index.d.ts",
    );
  });

  it("keeps the renderer free of Next.js and database imports", () => {
    const canvas = readFileSync(
      join(PACKAGE_ROOT, "src/components/atlas/AtlasCanvas.tsx"),
      "utf8",
    );

    expect(canvas).not.toContain('from "next/');
    expect(canvas).not.toContain('from "pg"');
    expect(canvas).not.toContain('from "@/');
  });
});
