import { readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { CheckResult, CheckSeverity, CheckStatus } from "../types";

export function check(input: {
  budget?: number;
  category: string;
  comparison?: "lte" | "gte";
  detail: string;
  docRef?: string;
  fix?: string;
  id: string;
  label: string;
  loadBearing?: boolean;
  measured?: number;
  rationale?: string;
  severity?: CheckSeverity;
  sotaBudget?: number;
  status: CheckStatus;
  unit?: string;
}): CheckResult {
  return {
    ...input,
    severity: input.severity ?? "error",
  };
}

/**
 * The default load-bearing rule is `severity === "error"`: an error-severity
 * failure blocks the quality gate. A check may override this by setting
 * `loadBearing` explicitly (e.g. to mark a warn-severity check as advisory-only
 * or to document an error-severity check as intentionally load-bearing).
 */
export function resolveLoadBearing(result: {
  loadBearing?: boolean;
  severity: CheckSeverity;
}): boolean {
  return result.loadBearing ?? result.severity === "error";
}

export function pass(
  id: string,
  category: string,
  label: string,
  detail: string,
  extras: Partial<CheckResult> = {},
): CheckResult {
  return check({ category, detail, id, label, status: "pass", ...extras });
}

export function warn(
  id: string,
  category: string,
  label: string,
  detail: string,
  extras: Partial<CheckResult> = {},
): CheckResult {
  return check({
    category,
    detail,
    id,
    label,
    severity: "warn",
    status: "warn",
    ...extras,
  });
}

export function fail(
  id: string,
  category: string,
  label: string,
  detail: string,
  extras: Partial<CheckResult> = {},
): CheckResult {
  return check({ category, detail, id, label, status: "fail", ...extras });
}

export function skip(
  id: string,
  category: string,
  label: string,
  detail: string,
  extras: Partial<CheckResult> = {},
): CheckResult {
  return check({
    category,
    detail,
    id,
    label,
    severity: "warn",
    status: "skip",
    ...extras,
  });
}

export function sourceFiles(root: string, dirs: string[]): string[] {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      const stats = statSync(path);
      if (stats.isDirectory()) return walk(path);
      if (/\.(ts|tsx|js|jsx|sql|json)$/.test(path)) return [path];
      return [];
    });
  }

  return dirs.flatMap((dir) => walk(join(root, dir)));
}

export function readSourceMap(root: string, dirs: string[]): Map<string, string> {
  return new Map(
    sourceFiles(root, dirs).map((file) => [
      file.replace(`${root}/`, ""),
      readFileSync(file, "utf8"),
    ]),
  );
}

export async function tryFetchJson(url: string): Promise<{
  body: Record<string, unknown> | null;
  bytes: number;
  ms: number;
  ok: boolean;
  status: number;
}> {
  const startedAt = performance.now();
  const response = await fetch(url);
  const text = await response.text();
  const ms = Number((performance.now() - startedAt).toFixed(2));
  let body: Record<string, unknown> | null = null;
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    body = null;
  }
  return {
    body,
    bytes: Buffer.byteLength(text),
    ms,
    ok: response.ok,
    status: response.status,
  };
}

export async function isServerReachable(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/atlas/views`);
    return response.status < 500;
  } catch {
    return false;
  }
}

export function hasPackage(packageName: string): boolean {
  const require = createRequire(import.meta.url);
  try {
    require.resolve(packageName);
    return true;
  } catch {
    return false;
  }
}
