import { execSync, spawn, type ChildProcess } from "node:child_process";
import { cpus, platform } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { BENCH_CONFIG } from "./benchmark.config";
import { printConsoleReport } from "./reporters/consoleReporter";
import { createReportFindings } from "./reporters/findings";
import { writeJsonReport } from "./reporters/jsonReporter";
import { writeMarkdownReport } from "./reporters/markdownReporter";
import type {
  BenchmarkContext,
  BenchmarkProfile,
  BenchmarkReport,
  CheckResult,
  ValidatorResult,
} from "./types";
import { VALIDATORS } from "./validators";
import { fail, isServerReachable } from "./validators/helpers";

function arg(name: string, fallback?: string): string | undefined {
  const direct = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  if (direct) return direct.split("=").slice(1).join("=");
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseProfile(): BenchmarkProfile {
  const raw = arg("profile", "standard");
  if (raw === "quick" || raw === "standard" || raw === "full") return raw;
  throw new Error(`Unknown benchmark profile: ${raw}`);
}

function parseValidators(profile: BenchmarkProfile): string[] {
  const raw = arg("validators");
  if (!raw) return [...BENCH_CONFIG.validatorsByProfile[profile]];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function gitCommit(): string | null {
  try {
    return execSync("git rev-parse --short HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function shouldStartServer(): boolean {
  return flag("start-server") || process.env.BENCH_START_SERVER === "true";
}

function serverScript(): "dev" | "start" {
  const raw = arg("server", process.env.BENCH_SERVER ?? "dev");
  if (raw === "dev" || raw === "start") return raw;
  throw new Error(`Unknown benchmark server mode: ${raw}`);
}

function localPort(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error(`Cannot auto-start non-local benchmark URL: ${baseUrl}`);
  }
  return url.port || (url.protocol === "https:" ? "443" : "80");
}

async function startServerIfNeeded(baseUrl: string): Promise<ChildProcess | null> {
  if (!shouldStartServer()) return null;
  if (await isServerReachable(baseUrl)) return null;

  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(command, ["run", serverScript(), "--", "--port", localPort(baseUrl)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ATLAS_DEMO_MODE: process.env.ATLAS_DEMO_MODE ?? "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const logs: string[] = [];
  child.stdout?.on("data", (data) => logs.push(String(data)));
  child.stderr?.on("data", (data) => logs.push(String(data)));

  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(
        `Benchmark server exited before becoming ready.\n${logs.slice(-10).join("")}`,
      );
    }
    if (await isServerReachable(baseUrl)) return child;
    await delay(250);
  }

  child.kill("SIGTERM");
  throw new Error(
    `Benchmark server did not become ready at ${baseUrl}.\n${logs.slice(-10).join("")}`,
  );
}

async function stopServer(child: ChildProcess | null): Promise<void> {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await delay(500);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function resolveView(baseUrl: string, fallback: string): Promise<string> {
  try {
    const response = await fetch(`${baseUrl}/api/atlas/views`);
    const body = (await response.json()) as { views?: Array<{ slug?: string }> };
    const slugs = (body.views ?? [])
      .map((view) => view.slug)
      .filter((slug): slug is string => typeof slug === "string");
    return slugs.includes(fallback) ? fallback : slugs[0] ?? fallback;
  } catch {
    return fallback;
  }
}

function summarize(validators: ValidatorResult[]): BenchmarkReport["summary"] {
  const all = validators.flatMap((validator) => validator.results);
  return {
    fail: all.filter((result) => result.status === "fail").length,
    gateFailures: all.filter(
      (result) => result.status === "fail" && result.severity === "error",
    ).length,
    pass: all.filter((result) => result.status === "pass").length,
    skip: all.filter((result) => result.status === "skip").length,
    warn: all.filter((result) => result.status === "warn").length,
  };
}

async function runValidator(
  name: string,
  context: BenchmarkContext,
): Promise<ValidatorResult> {
  const validator = VALIDATORS[name];
  if (!validator) {
    const result: CheckResult = fail(
      `validator-${name}-missing`,
      "runner",
      `Validator ${name} exists`,
      `No benchmark validator registered for "${name}".`,
    );
    return { validator: name, results: [result] };
  }

  try {
    return await validator(context);
  } catch (error) {
    return {
      validator: name,
      results: [
        fail(
          `validator-${name}-error`,
          "runner",
          `Validator ${name} runs`,
          error instanceof Error ? error.message : String(error),
        ),
      ],
    };
  }
}

async function run() {
  const profile = parseProfile();
  const baseUrl = (arg("base", BENCH_CONFIG.baseUrl) ?? BENCH_CONFIG.baseUrl).replace(
    /\/$/,
    "",
  );
  const startedServer = await startServerIfNeeded(baseUrl);

  try {
    const validators = parseValidators(profile);
    const context: BenchmarkContext = {
      baseUrl,
      gate: flag("gate"),
      profile,
      repetitions: BENCH_CONFIG.repetitions[profile],
      validators,
      view: await resolveView(baseUrl, BENCH_CONFIG.defaultView),
    };

    const validatorResults: ValidatorResult[] = [];
    for (const name of validators) {
      validatorResults.push(await runValidator(name, context));
    }

    const report: BenchmarkReport = {
      findings: createReportFindings(validatorResults),
      meta: {
        baseUrl,
        gate: context.gate,
        gitCommit: gitCommit(),
        node: process.version,
        platform: `${platform()} ${process.arch} ${cpus()[0]?.model ?? "unknown CPU"}`,
        profile,
        timestamp: new Date().toISOString(),
      },
      summary: summarize(validatorResults),
      validators: validatorResults,
    };

    const jsonPath = join(BENCH_CONFIG.resultsDir, "latest.json");
    const markdownPath = join(BENCH_CONFIG.resultsDir, "latest.md");
    writeJsonReport(report, jsonPath);
    writeMarkdownReport(report, markdownPath);
    printConsoleReport(report);
    console.log(`Reports written to ${jsonPath} and ${markdownPath}`);

    if (context.gate && report.summary.gateFailures > 0) {
      process.exitCode = 1;
    }
  } finally {
    await stopServer(startedServer);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
