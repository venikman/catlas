import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ATLAS_CONTRACT_GOLDEN_FIXTURES,
  assertAtlasContractRows,
  buildDensityTiles,
  validateAtlasContractRows,
} from "@catlas/atlas-react/contract";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const DATA_PREP_SUMMARY_PREFIX = "ATLAS_DATA_PREP_SUMMARY ";

function log(message) {
  console.log(`[atlas-conformance] ${message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertGoldenFixtures() {
  for (const fixture of Object.values(ATLAS_CONTRACT_GOLDEN_FIXTURES)) {
    const result = validateAtlasContractRows(fixture);
    assert(result.ok, `golden fixture ${fixture.name} failed validation`);
  }
  log("golden fixtures validated");
}

function assertParameterizedDensity() {
  const fixture = ATLAS_CONTRACT_GOLDEN_FIXTURES.unitWorld;
  const tiles = buildDensityTiles(fixture.points, {
    tileCount: 5,
    worldBounds: fixture.worldBounds,
    z: 4,
  });

  assert(tiles.every((tile) => tile.z === 4), "density z option was ignored");
  assert(
    tiles.every((tile) => tile.xTile >= 0 && tile.xTile < 5),
    "density xTile escaped tileCount",
  );
  assert(
    tiles.every((tile) => tile.yTile >= 0 && tile.yTile < 5),
    "density yTile escaped tileCount",
  );
  assertAtlasContractRows({
    densityTiles: tiles,
    points: fixture.points,
    worldBounds: fixture.worldBounds,
  });
  log("parameterized density tiling validated");
}

function runDataPrepRecipe() {
  const output = execFileSync(
    npmCommand,
    ["run", "conformance", "-w", "examples/atlas-data-prep"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const summaryLine = output
    .split(/\r?\n/)
    .find((line) => line.startsWith(DATA_PREP_SUMMARY_PREFIX));
  assert(summaryLine, "atlas-data-prep did not print a JSON summary");
  const summary = JSON.parse(summaryLine.slice(DATA_PREP_SUMMARY_PREFIX.length));
  assert(summary.ok === true, "atlas-data-prep summary was not ok");
  assert(summary.points > 0, "atlas-data-prep produced no points");
  log("plain JavaScript data-prep recipe validated");
}

function packAndImportOutsideRepo() {
  const tempRoot = mkdtempSync(join(tmpdir(), "catlas-contract-"));
  try {
    const packDir = join(tempRoot, "pack");
    const consumerDir = join(tempRoot, "consumer");
    const scopedPackageDir = join(
      consumerDir,
      "node_modules",
      "@catlas",
      "atlas-react",
    );
    mkdirSync(packDir, { recursive: true });
    mkdirSync(consumerDir, { recursive: true });

    const packOutput = execFileSync(
      npmCommand,
      [
        "pack",
        "--json",
        "--workspace",
        "@catlas/atlas-react",
        "--pack-destination",
        packDir,
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    const packEntries = JSON.parse(packOutput);
    const filename = packEntries.at(-1)?.filename;
    assert(filename, "npm pack --json did not return a tarball filename");
    const tarball = join(packDir, filename);

    writeFileSync(
      join(consumerDir, "package.json"),
      JSON.stringify(
        {
          dependencies: {
            "@catlas/atlas-react": tarball,
          },
          private: true,
          type: "module",
        },
        null,
        2,
      ),
    );
    execFileSync(
      npmCommand,
      [
        "install",
        "--ignore-scripts",
        "--package-lock=false",
        "--no-audit",
        "--no-fund",
        "--legacy-peer-deps",
      ],
      { cwd: consumerDir, stdio: "ignore" },
    );

    const packageJsonPath = join(scopedPackageDir, "package.json");
    const packedManifest = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    assert(
      packedManifest.exports?.["./contract"]?.import === "./dist/contract/index.js",
      "packed manifest does not expose ./contract",
    );
    assert(
      !resolve(scopedPackageDir).startsWith(repoRoot),
      "packed smoke path is inside the monorepo",
    );

    const smokeFile = join(consumerDir, "smoke.mjs");
    writeFileSync(
      smokeFile,
      [
        "import {",
        "  ATLAS_CONTRACT_GOLDEN_FIXTURES,",
        "  assertAtlasContractRows,",
        "} from '@catlas/atlas-react/contract';",
        "import { getLodForZoom } from '@catlas/atlas-react/lod';",
        "assertAtlasContractRows(ATLAS_CONTRACT_GOLDEN_FIXTURES.defaultWorld);",
        "if (getLodForZoom(7).layer !== 'points') throw new Error('LOD import failed');",
        "console.log('packed import ok');",
      ].join("\n"),
    );

    const smokeOutput = execFileSync("node", [smokeFile], {
      cwd: consumerDir,
      encoding: "utf8",
    });
    assert(smokeOutput.includes("packed import ok"), "packed import smoke failed");
    log("packed tarball imported outside the monorepo");
  } finally {
    rmSync(tempRoot, { force: true, recursive: true });
  }
}

assertGoldenFixtures();
assertParameterizedDensity();
runDataPrepRecipe();
packAndImportOutsideRepo();
log("all checks passed");
