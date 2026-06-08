import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function monorepoRoot(start = process.cwd()): string {
  let dir = start;
  for (let depth = 0; depth < 8; depth += 1) {
    if (
      existsSync(join(dir, "packages/atlas-benchmarks")) &&
      existsSync(join(dir, "apps/semantic-atlas"))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

export function appRoot(start = process.cwd()): string {
  return join(monorepoRoot(start), "apps/semantic-atlas");
}

export function atlasReactSourceRoot(start = process.cwd()): string {
  return join(monorepoRoot(start), "packages/atlas-react/src");
}

export function readAppSource(relativePath: string, start = process.cwd()): string {
  return readFileSync(join(appRoot(start), relativePath), "utf8");
}

export function readAtlasReactSource(relativePath: string, start = process.cwd()): string {
  return readFileSync(join(atlasReactSourceRoot(start), relativePath), "utf8");
}
