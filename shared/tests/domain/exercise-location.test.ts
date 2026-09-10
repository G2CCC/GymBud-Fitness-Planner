import { describe, expect, it } from "vitest";
import {
  isExerciseAvailableAtLocation,
  normalizeEquipment,
  validateExerciseLocations,
} from "@fitness/shared/domain/exercises/location";

describe("exercise location rules", () => {
  it("allows a bodyweight exercise in both locations", () => {
    expect(() =>
      validateExerciseLocations("NONE", ["GYM", "HOME"]),
    ).not.toThrow();
  });

  it("treats an omitted equipment value as bodyweight", () => {
    expect(() =>
      validateExerciseLocations(null, ["GYM", "HOME"]),
    ).not.toThrow();
  });

  it("normalizes case-insensitive bodyweight equipment", () => {
    expect(normalizeEquipment(" none ")).toBe("NONE");
    expect(() =>
      validateExerciseLocations(" none ", ["GYM", "HOME"]),
    ).not.toThrow();
  });

  it("requires equipment exercises to be gym-only", () => {
    expect(() => validateExerciseLocations("BARBELL", ["GYM"])).not.toThrow();
    expect(() =>
      validateExerciseLocations("BARBELL", ["HOME"]),
    ).toThrow(/GYM/);
    expect(() =>
      validateExerciseLocations("BARBELL", ["GYM", "HOME"]),
    ).toThrow(/GYM/);
  });

  it("rejects a bodyweight exercise that is missing one supported location", () => {
    expect(() => validateExerciseLocations("NONE", ["GYM"])).toThrow(
      /GYM and HOME/,
    );
  });

  it("rejects an exercise without a location classification", () => {
    expect(() => validateExerciseLocations("NONE", [])).toThrow(
      /at least one location/,
    );
  });

  it("filters an exercise by its persisted locations", () => {
    expect(
      isExerciseAvailableAtLocation(
        { availableLocations: ["GYM", "HOME"] },
        "HOME",
      ),
    ).toBe(true);
    expect(
      isExerciseAvailableAtLocation(
        { availableLocations: ["GYM"] },
        "HOME",
      ),
    ).toBe(false);
  });
});
