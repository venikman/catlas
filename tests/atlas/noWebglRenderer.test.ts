import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SOURCE_DIRS = ["app", "components", "lib"];
const FORBIDDEN_SOURCE_PATTERNS = [
  /@deck\.gl/,
  /\bDeckGL\b/,
  /deck\.gl/i,
  /createContext\(\s*["']webgl/i,
  /<canvas\b/i,
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
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const dependencies = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };

    expect(Object.keys(dependencies).filter((name) => name.startsWith("@deck.gl/"))).toEqual([]);
  });

  it("does not create WebGL or canvas renderer entry points in app source", () => {
    const offenders = SOURCE_DIRS.flatMap((dir) => sourceFiles(join(ROOT, dir)))
      .flatMap((file) => {
        const text = readFileSync(file, "utf8");
        return FORBIDDEN_SOURCE_PATTERNS
          .filter((pattern) => pattern.test(text))
          .map((pattern) => `${file.replace(`${ROOT}/`, "")}: ${pattern}`);
      });

    expect(offenders).toEqual([]);
  });
});
