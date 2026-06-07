import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BENCH_CONFIG } from "./benchmark.config";

const reportPath = join(BENCH_CONFIG.resultsDir, "latest.md");

if (!existsSync(reportPath)) {
  console.log("No benchmark report found. Run npm run bench:atlas:quick first.");
  process.exit(0);
}

console.log(readFileSync(reportPath, "utf8"));
