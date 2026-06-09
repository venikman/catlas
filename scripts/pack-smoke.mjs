import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const packageName = "@catlas/atlas-react";

function log(message) {
  console.log(`[pack-smoke] ${message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runNpm(args, options = {}) {
  return execFileSync(npmCommand, args, {
    cwd: repoRoot,
    encoding: "utf8",
    ...options,
  });
}

function assertTarballShipsDist() {
  log(`inspecting packed contents for ${packageName} (npm pack --dry-run)`);
  const dryRunOutput = runNpm([
    "pack",
    "--dry-run",
    "--json",
    "--workspace",
    packageName,
  ]);
  const dryRunEntries = JSON.parse(dryRunOutput);
  const entry = dryRunEntries.at(-1);
  assert(entry, "npm pack --dry-run --json returned no package metadata");
  const files = Array.isArray(entry.files) ? entry.files : [];
  assert(files.length > 0, "npm pack --dry-run reported no files");
  const distJsEntry = files.find((file) => {
    const path = typeof file === "string" ? file : file.path;
    return typeof path === "string" && /^dist\/.+\.js$/.test(path);
  });
  assert(
    distJsEntry,
    "packed tarball does not include any dist/*.js entry (prepack build did not run)",
  );
  log("packed contents include compiled dist/*.js");
}

function packTarball(packDir) {
  log(`running npm pack (prepack build) into ${packDir}`);
  const packOutput = runNpm([
    "pack",
    "--json",
    "--workspace",
    packageName,
    "--pack-destination",
    packDir,
  ]);
  const packEntries = JSON.parse(packOutput);
  const filename = packEntries.at(-1)?.filename;
  assert(filename, "npm pack --json did not return a tarball filename");
  const tarball = join(packDir, filename);
  log(`created tarball ${filename}`);
  return tarball;
}

function smokeImportOutsideRepo(tarball) {
  const consumerDir = mkdtempSync(join(tmpdir(), "catlas-pack-smoke-"));
  assert(
    !resolve(consumerDir).startsWith(repoRoot),
    "pack smoke consumer dir is inside the monorepo",
  );
  log(`created external consumer dir ${consumerDir}`);

  log("npm init -y");
  runNpm(["init", "-y"], { cwd: consumerDir, stdio: "ignore" });

  writeFileSync(
    join(consumerDir, "package.json"),
    JSON.stringify(
      {
        name: "catlas-pack-smoke-consumer",
        private: true,
        type: "module",
        version: "0.0.0",
      },
      null,
      2,
    ),
  );

  log("installing tarball plus react + react-dom");
  runNpm(
    [
      "install",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      tarball,
      "react@^18.3.0",
      "react-dom@^18.3.0",
    ],
    { cwd: consumerDir, stdio: "ignore" },
  );

  const smokeFile = join(consumerDir, "smoke.mjs");
  writeFileSync(
    smokeFile,
    [
      "import { SemanticAtlasMap } from '@catlas/atlas-react';",
      "import {",
      "  ATLAS_CONTRACT_VERSION,",
      "  ATLAS_SELECTORS,",
      "  validateAtlasContractRows,",
      "} from '@catlas/atlas-react/contract';",
      "import '@catlas/atlas-react/types';",
      "if (typeof SemanticAtlasMap !== 'function') {",
      "  throw new Error('SemanticAtlasMap did not resolve to a component');",
      "}",
      "if (typeof ATLAS_CONTRACT_VERSION !== 'string') {",
      "  throw new Error('ATLAS_CONTRACT_VERSION did not resolve to a string');",
      "}",
      "if (typeof ATLAS_SELECTORS?.root !== 'string') {",
      "  throw new Error('ATLAS_SELECTORS did not resolve');",
      "}",
      "if (typeof validateAtlasContractRows !== 'function') {",
      "  throw new Error('validateAtlasContractRows did not resolve');",
      "}",
      "console.log('pack smoke import ok ' + ATLAS_CONTRACT_VERSION);",
    ].join("\n"),
  );

  log("running ESM smoke module with node");
  const smokeOutput = execFileSync("node", [smokeFile], {
    cwd: consumerDir,
    encoding: "utf8",
  });
  assert(
    smokeOutput.includes("pack smoke import ok"),
    "external smoke import did not succeed",
  );
  log("external smoke import succeeded");
}

function main() {
  const tempRoot = mkdtempSync(join(tmpdir(), "catlas-pack-"));
  try {
    const packDir = join(tempRoot, "pack");
    mkdirSync(packDir, { recursive: true });

    assertTarballShipsDist();
    const tarball = packTarball(packDir);
    smokeImportOutsideRepo(tarball);

    log("all checks passed");
  } catch (error) {
    console.error(
      `[pack-smoke] FAILED: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
    throw error;
  } finally {
    rmSync(tempRoot, { force: true, recursive: true });
  }
}

try {
  main();
} catch {
  process.exitCode = process.exitCode || 1;
}
