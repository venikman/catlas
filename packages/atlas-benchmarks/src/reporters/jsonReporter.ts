import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { BenchmarkReport } from "../types";

export function writeJsonReport(report: BenchmarkReport, path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
}
