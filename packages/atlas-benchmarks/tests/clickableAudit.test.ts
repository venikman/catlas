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

  it("keeps map controls and OntoTwin audit hooks wired for clickable audit", () => {
    const controls = readFileSync(
      join(APP_ROOT, "components/atlas/AtlasControls.tsx"),
      "utf8",
    );
    const lodControls = readFileSync(
      join(APP_ROOT, "components/atlas/AtlasLodControls.tsx"),
      "utf8",
    );
    const sidePanel = readFileSync(
      join(APP_ROOT, "components/atlas/AtlasSidePanel.tsx"),
      "utf8",
    );
    const search = readFileSync(
      join(APP_ROOT, "components/atlas/AtlasSearch.tsx"),
      "utf8",
    );

    expect(controls).toContain('data-atlas-action="home"');
    expect(controls).toContain('data-atlas-action="zoom-in"');
    expect(controls).toContain('data-atlas-action="zoom-out"');
    expect(controls).toContain('data-atlas-kind="map-control"');
    expect(lodControls).toContain('data-atlas-kind="lod-button"');
    expect(lodControls).toContain("aria-pressed={active === layer}");
    expect(sidePanel).toContain('data-atlas-kind="view-button"');
    expect(sidePanel).toContain('data-atlas-kind="layer-toggle"');
    expect(sidePanel).toContain("aria-pressed={enabled}");
    expect(search).toContain('data-testid="atlas-search-input"');
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
