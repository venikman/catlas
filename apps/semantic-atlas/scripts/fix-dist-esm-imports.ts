import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const rootDir = process.argv[2];

if (!rootDir) {
  throw new Error("Usage: tsx scripts/fix-dist-esm-imports.ts <dist-dir>");
}

const explicitExtensions = new Set([
  ".cjs",
  ".css",
  ".json",
  ".js",
  ".mjs",
  ".node",
  ".wasm",
]);

function withJsExtension(specifier: string): string {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) return specifier;
  if (explicitExtensions.has(extname(specifier))) return specifier;
  return `${specifier}.js`;
}

function rewriteImports(source: string): string {
  return source.replace(
    /(from\s+["'])(\.{1,2}\/[^"']+)(["'])/g,
    (_match, prefix: string, specifier: string, suffix: string) =>
      `${prefix}${withJsExtension(specifier)}${suffix}`,
  );
}

async function rewriteDirectory(directory: string) {
  const entries = await readdir(directory);
  for (const entry of entries) {
    const filePath = join(directory, entry);
    const info = await stat(filePath);
    if (info.isDirectory()) {
      await rewriteDirectory(filePath);
      continue;
    }
    if (!entry.endsWith(".js")) continue;

    const source = await readFile(filePath, "utf8");
    const nextSource = rewriteImports(source);
    if (nextSource !== source) {
      await writeFile(filePath, nextSource);
    }
  }
}

await rewriteDirectory(rootDir);
