import { describe, expect, it } from "vitest";
import { fail, warn } from "../src/validators/helpers";

describe("check helpers carry teach metadata", () => {
  it("fail threads rationale/fix/docRef through extras and stays gate-blocking", () => {
    const result = fail("points-bbox-validation", "architecture", "label", "detail", {
      rationale: "why it matters",
      fix: "how to fix it",
      docRef: "docs/adoption/CONTRACT.md#5-the-field-boundary-replaces-auth",
    });

    expect(result).toMatchObject({
      status: "fail",
      severity: "error",
      rationale: "why it matters",
      fix: "how to fix it",
      docRef: "docs/adoption/CONTRACT.md#5-the-field-boundary-replaces-auth",
    });
  });

  it("warn threads teach metadata and is advisory (non-gate-blocking)", () => {
    const result = warn("renderer-point-elements", "architecture", "label", "detail", {
      rationale: "why it matters",
      fix: "how to fix it",
    });

    expect(result.severity).toBe("warn");
    expect(result.rationale).toBe("why it matters");
    expect(result.fix).toBe("how to fix it");
  });
});
