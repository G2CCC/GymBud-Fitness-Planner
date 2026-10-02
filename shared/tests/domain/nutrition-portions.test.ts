import { describe, it, expect } from "vitest";
import { calculateFoodPortion } from "../../src/domain/nutrition/portions";
const egg = {
  name: "Egg",
  per100g: { kcal: 140, proteinG: 12, carbsG: 1, fatG: 10 },
  unitGrams: 50,
};
describe("food portions", () => {
  it.each(["g", "ea"] as const)(
    "scales %s without deriving food energy from macros",
    (unit) => {
      expect(calculateFoodPortion(egg, unit, unit === "g" ? 75 : 1.5)).toEqual({
        grams: 75,
        totals: { kcal: 105, proteinG: 9, carbsG: 0.75, fatG: 7.5 },
      });
    },
  );
  it.each([0, -1, NaN, Infinity])("rejects quantity %s", (quantity) =>
    expect(() => calculateFoodPortion(egg, "g", quantity)).toThrow(),
  );
  it("does not invent an each weight", () =>
    expect(() =>
      calculateFoodPortion({ ...egg, unitGrams: null }, "ea", 1),
    ).toThrow());
});
