import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MONOREPO_ROOT = join(PACKAGE_ROOT, "../..");
const APP_ROOT = join(MONOREPO_ROOT, "apps/semantic-atlas");

describe("atlas clickable audit", () => {
  it("exercises stateful atlas controls and writes a gateable report", () => {
    const audit = readFileSync(
      join(PACKAGE_ROOT, "src/run-clickable-audit.ts"),
      "utf8",
    );

    expect(audit).toContain("Atlas clickable audit");
    expect(audit).toContain("clickLod");
    expect(audit).toContain("auditLayerToggles");
    expect(audit).toContain("auditViewButtons");
    expect(audit).toContain("auditSearchAndInspector");
    expect(audit).toContain("auditClusterClick");
    expect(audit).toContain("auditViewportInteraction");
    expect(audit).toContain("clickable-audit-latest.json");
    expect(audit).toContain("interaction.webm");
  });

  it("keeps fake placeholder controls disabled and map controls auditable", () => {
    const controls = readFileSync(
      join(APP_ROOT, "components/atlas/AtlasControls.tsx"),
      "utf8",
    );
    const viewer = readFileSync(
      join(APP_ROOT, "components/atlas/AtlasViewer.tsx"),
      "utf8",
    );
    const search = readFileSync(
      join(APP_ROOT, "components/atlas/AtlasSearch.tsx"),
      "utf8",
    );

    expect(controls).toContain('data-atlas-action="home"');
    expect(controls).toContain('data-atlas-action="zoom-in"');
    expect(controls).toContain('data-atlas-action="zoom-out"');
    expect(controls).toContain('data-atlas-action="locate-selected"');
    expect(controls).toContain("disabled");
    expect(viewer).toContain('data-atlas-kind="view-button"');
    expect(viewer).toContain('data-atlas-kind="layer-toggle"');
    expect(viewer).toContain("aria-pressed={active === layer}");
    expect(search).toContain('aria-label="Search settings"');
    expect(search).toContain("disabled");
    expect(search).toContain("const queryText = q.trim()");
    expect(search).not.toContain("useDeferredValue");
  });

  it("exposes workspace scripts for the audit", () => {
    const packageManifest = JSON.parse(
      readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    const rootManifest = JSON.parse(
      readFileSync(join(MONOREPO_ROOT, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(packageManifest.scripts?.clickable).toContain("run-clickable-audit");
    expect(rootManifest.scripts?.["bench:atlas:clickable"]).toContain(
      "@catlas/atlas-benchmarks",
    );
  });
});
