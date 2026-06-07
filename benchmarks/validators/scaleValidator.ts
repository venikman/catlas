import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ATLAS_LOD_CONFIG, getLodForZoom } from "../../lib/atlas/lod";
import { ATLAS_RUNTIME_CONFIG } from "../../lib/atlas/runtimeConfig";
import { BUDGETS } from "../budgets";
import { computeBbox, scenarioUrl } from "../scenarios";
import type { BenchmarkContext, CheckResult, ValidatorResult } from "../types";
import { fail, isServerReachable, pass, skip, tryFetchJson, warn } from "./helpers";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

export async function scaleValidator(
  context: BenchmarkContext,
): Promise<ValidatorResult> {
  const results: CheckResult[] = [];
  const generatorSource = source("scripts/generate-atlas.ts");
  const low = getLodForZoom(1.2);
  const medium = getLodForZoom(4.2);
  const high = getLodForZoom(7.2);
  const generatorStreams =
    /createWriteStream/.test(generatorSource) &&
    /batchSize/.test(generatorSource) &&
    /arg\("count"/.test(generatorSource);

  results.push(
    low.endpoint === "/api/atlas/density" && medium.endpoint === "/api/atlas/clusters"
      ? pass(
          "scale-10m-aggregate-lod",
          "scale",
          "10M simulation uses aggregates below high zoom",
          `Low zoom endpoint ${low.endpoint}; medium zoom endpoint ${medium.endpoint}.`,
        )
      : fail(
          "scale-10m-aggregate-lod",
          "scale",
          "10M simulation uses aggregates below high zoom",
          `Expected density/clusters below high zoom; got ${low.endpoint} and ${medium.endpoint}.`,
        ),
  );

  results.push(
    high.endpoint === "/api/atlas/points" &&
      ATLAS_RUNTIME_CONFIG.limits.maxPoints <= BUDGETS.bounds.maxPointsPerResponse
      ? pass(
          "scale-10m-point-cap",
          "scale",
          "High zoom has a hard point cap",
          `High zoom endpoint is ${high.endpoint}; max point response is ${ATLAS_RUNTIME_CONFIG.limits.maxPoints}.`,
          {
            budget: BUDGETS.bounds.maxPointsPerResponse,
            measured: ATLAS_RUNTIME_CONFIG.limits.maxPoints,
            unit: "points",
          },
        )
      : fail(
          "scale-10m-point-cap",
          "scale",
          "High zoom has a hard point cap",
          `High zoom endpoint ${high.endpoint}; max point response ${ATLAS_RUNTIME_CONFIG.limits.maxPoints}.`,
          {
            budget: BUDGETS.bounds.maxPointsPerResponse,
            measured: ATLAS_RUNTIME_CONFIG.limits.maxPoints,
            unit: "points",
          },
        ),
  );

  results.push(
    ATLAS_LOD_CONFIG.maxClusters <= BUDGETS.bounds.maxClustersPerResponse &&
      ATLAS_LOD_CONFIG.maxDensityTiles <= BUDGETS.bounds.maxDensityTilesPerResponse
      ? pass(
          "scale-aggregate-caps",
          "scale",
          "Aggregate layers have response caps",
          `Cluster cap ${ATLAS_LOD_CONFIG.maxClusters}; density tile cap ${ATLAS_LOD_CONFIG.maxDensityTiles}.`,
        )
      : fail(
          "scale-aggregate-caps",
          "scale",
          "Aggregate layers have response caps",
          `Cluster cap ${ATLAS_LOD_CONFIG.maxClusters}; density cap ${ATLAS_LOD_CONFIG.maxDensityTiles}.`,
        ),
  );

  results.push(
    generatorStreams
      ? pass(
          "scale-generator-streaming",
          "scale",
          "Synthetic generator streams batched output",
          "Generator accepts --count, uses batchSize, and writes JSONL through createWriteStream.",
        )
      : warn(
          "scale-generator-streaming",
          "scale",
          "Synthetic generator streams batched output",
          "Generator does not clearly support batched streaming output.",
        ),
  );

  if (await isServerReachable(context.baseUrl)) {
    const oversized = await tryFetchJson(
      scenarioUrl(context.baseUrl, context.view, {
        bbox: {
          minX: -30,
          maxX: 30,
          minY: -30,
          maxY: 30,
        },
        endpoint: "points",
        expectStatus: 400,
        id: "scale-oversized-high-zoom",
        label: "Oversized high-zoom bbox rejected",
        zoom: 7.2,
      }),
    );
    results.push(
      oversized.status === 400
        ? pass(
            "scale-unsafe-high-zoom-reject",
            "scale",
            "Unsafe high-zoom bbox is rejected",
            `Oversized high-zoom point query returned status 400 in ${oversized.ms} ms.`,
            { measured: oversized.ms, unit: "ms" },
          )
        : fail(
            "scale-unsafe-high-zoom-reject",
            "scale",
            "Unsafe high-zoom bbox is rejected",
            `Expected status 400, received ${oversized.status}.`,
          ),
    );

    const lowZoomPoints = await tryFetchJson(
      scenarioUrl(context.baseUrl, context.view, {
        bbox: computeBbox(1.1, 0.42, 1.2),
        endpoint: "points",
        expectStatus: 400,
        id: "scale-low-zoom-points",
        label: "Low zoom points rejected",
        zoom: 1.2,
      }),
    );
    results.push(
      lowZoomPoints.status === 400
        ? pass(
            "scale-low-raw-reject",
            "scale",
            "Low zoom cannot fetch raw points",
            "Low-zoom raw point request returned status 400.",
          )
        : fail(
            "scale-low-raw-reject",
            "scale",
            "Low zoom cannot fetch raw points",
            `Expected status 400, received ${lowZoomPoints.status}.`,
          ),
    );
  } else {
    results.push(
      skip(
        "scale-runtime-skip",
        "scale",
        "Runtime scale simulation",
        `Server not reachable at ${context.baseUrl}; static scale checks still ran.`,
      ),
    );
  }

  return { validator: "scale", results };
}
