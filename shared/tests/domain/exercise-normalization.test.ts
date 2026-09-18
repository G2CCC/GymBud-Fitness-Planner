import { describe, expect, it } from "vitest";
import { normalizeEquipment } from "@fitness/shared/domain/exercises/normalization";

describe("exercise metadata normalization", () => {
  it("normalizes bodyweight equipment", () => {
    expect(normalizeEquipment(" none ")).toBe("NONE");
    expect(normalizeEquipment(null)).toBe("NONE");
  });

  it("preserves named equipment", () => {
    expect(normalizeEquipment("barbell")).toBe("barbell");
  });
});
