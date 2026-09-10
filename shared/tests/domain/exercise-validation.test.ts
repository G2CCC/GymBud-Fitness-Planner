import { describe, expect, it } from "vitest";
import { customExerciseInputSchema } from "@fitness/shared/domain/validation";

describe("custom exercise validation", () => {
  it("accepts confirmed bodyweight metadata for both locations", () => {
    const result = customExerciseInputSchema.parse({
      name: "Push-up",
      description: "A horizontal bodyweight press.",
      equipment: "NONE",
      targetMuscles: ["CHEST", "TRICEPS"],
      movementPattern: "PUSH",
      availableLocations: ["GYM", "HOME"],
    });

    expect(result.name).toBe("Push-up");
  });

  it("rejects an equipment exercise classified as home-compatible", () => {
    expect(() =>
      customExerciseInputSchema.parse({
        name: "Barbell Row",
        equipment: "BARBELL",
        targetMuscles: ["BACK"],
        movementPattern: "PULL",
        availableLocations: ["HOME"],
      }),
    ).toThrow(/GYM/);
  });

  it("rejects a custom exercise without target muscles", () => {
    expect(() =>
      customExerciseInputSchema.parse({
        name: "Unknown Movement",
        equipment: "NONE",
        targetMuscles: [],
        availableLocations: ["GYM", "HOME"],
      }),
    ).toThrow();
  });
});
