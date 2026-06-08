import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MONOREPO_ROOT = join(PACKAGE_ROOT, "../..");
const APP_ROOT = join(MONOREPO_ROOT, "apps/semantic-atlas");
const SOURCE_DIRS = [
  join(APP_ROOT, "app"),
  join(APP_ROOT, "components"),
  join(APP_ROOT, "lib"),
  join(PACKAGE_ROOT, "src"),
];
const FORBIDDEN_SOURCE_PATTERNS = [
  /@deck\.gl/,
  /\bDeckGL\b/,
  /deck\.gl/i,
  /createContext\(\s*["']webgl/i,
  /getContext\(\s*["']webgl/i,
  /WEBGL_debug_renderer_info/i,
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) return sourceFiles(path);
    if (/\.(ts|tsx|js|jsx)$/.test(path)) return [path];
    return [];
  });
}

describe("no-WebGL atlas renderer", () => {
  it("does not depend on deck.gl packages", () => {
    const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const dependencies = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };

    expect(Object.keys(dependencies).filter((name) => name.startsWith("@deck.gl/"))).toEqual([]);
  });

  it("does not create WebGL renderer entry points in app or package source", () => {
    const offenders = SOURCE_DIRS.flatMap((dir) => sourceFiles(dir))
      .flatMap((file) => {
        const text = readFileSync(file, "utf8");
        return FORBIDDEN_SOURCE_PATTERNS.filter((pattern) => pattern.test(text)).map(
          (pattern) => `${file}: ${pattern}`,
        );
      });

    expect(offenders).toEqual([]);
  });

  it("uses the Canvas 2D texture layer without adding WebGL", () => {
    const atlasCanvas = readFileSync(
      join(PACKAGE_ROOT, "src/components/atlas/AtlasCanvas.tsx"),
      "utf8",
    );

    expect(atlasCanvas).toContain('data-testid="atlas-map-canvas"');
    expect(atlasCanvas).toMatch(/getContext\(\s*["']2d/);
    expect(atlasCanvas).not.toMatch(/getContext\(\s*["']webgl/i);
  });
});
