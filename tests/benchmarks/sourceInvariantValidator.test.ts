import { describe, expect, it } from "vitest";
import { scanSourceInvariants } from "../../benchmarks/validators/sourceInvariantValidator";

describe("source invariant validator", () => {
  it("keeps gate-blocking atlas architecture invariants passing", () => {
    const invariants = scanSourceInvariants();
    const blockingFailures = invariants.filter(
      (invariant) => invariant.severity === "error" && !invariant.ok,
    );

    expect(blockingFailures).toEqual([]);
  });

  it("tracks the current bounded SVG renderer risk as a warning invariant", () => {
    const invariants = scanSourceInvariants();
    const rendererInvariant = invariants.find(
      (invariant) => invariant.id === "renderer-point-elements",
    );

    expect(rendererInvariant?.severity).toBe("warn");
  });
});
