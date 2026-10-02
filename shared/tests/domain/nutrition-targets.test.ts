import { describe, it, expect } from "vitest";
import { calculateNutritionTarget } from "../../src/domain/nutrition/targets";
const profile = {
  sex: "MALE" as const,
  age: 27,
  heightCm: 180,
  weightKg: 80,
  primaryGoal: "FAT_LOSS" as const,
};
describe("fixed nutrition targets", () => {
  it.each([
    ["FAT_LOSS", 1939, 144, 195.3, 64.6],
    ["MUSCLE_GAIN", 2262, 144, 251.9, 75.4],
    ["MAINTENANCE", 2154, 128, 249, 71.8],
  ] as const)(
    "calculates %s independently of training",
    (primaryGoal, kcal, proteinG, carbsG, fatG) => {
      expect(calculateNutritionTarget({ ...profile, primaryGoal })).toEqual({
        kcal,
        proteinG,
        carbsG,
        fatG,
        algorithmVersion: "nutrition-v1",
      });
    },
  );
  it("uses the female offset in the same age formula", () => {
    expect(
      calculateNutritionTarget({
        ...profile,
        sex: "FEMALE",
        primaryGoal: "MAINTENANCE",
      }).kcal,
    ).toBe(1955);
  });
  it.each([NaN, Infinity, -1, 0])("rejects invalid weight %s", (weightKg) => {
    expect(() => calculateNutritionTarget({ ...profile, weightKg })).toThrow();
  });
  it("rejects negative carbohydrates instead of silently clamping", () => {
    expect(() =>
      calculateNutritionTarget({
        ...profile,
        age: 100,
        heightCm: 50,
        weightKg: 20,
      }),
    ).toThrow();
  });
});
