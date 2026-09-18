import { describe, expect, it } from "vitest";
import { customExerciseInputSchema } from "@fitness/shared/domain/validation";

describe("custom exercise validation", () => {
  it("accepts confirmed exercise metadata without a location classification", () => {
    const result = customExerciseInputSchema.parse({
      name: "Push-up",
      description: "A horizontal bodyweight press.",
      equipment: "NONE",
      targetMuscles: ["CHEST", "TRICEPS"],
      movementPattern: "PUSH",
    });

    expect(result.name).toBe("Push-up");
  });

  it("rejects a custom exercise without target muscles", () => {
    expect(() =>
      customExerciseInputSchema.parse({
        name: "Unknown Movement",
        equipment: "NONE",
        targetMuscles: [],
      }),
    ).toThrow();
  });
});
