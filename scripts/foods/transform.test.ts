import { describe, it, expect } from "vitest";
import { normalizeFood, type SourceFood } from "./transform";
const nutrient = (id: number, unitName: string, amount: number) => ({
  nutrient: { id, unitName },
  amount,
});
const food: SourceFood = {
  fdcId: 1,
  dataType: "SR Legacy",
  description: "Egg test",
  foodNutrients: [
    nutrient(1008, "kcal", 100),
    nutrient(1062, "kJ", 418.4),
    nutrient(1003, "g", 12),
    nutrient(1004, "g", 0),
    nutrient(1005, "g", 2),
  ],
  foodPortions: [
    { id: 10, modifier: "large", amount: 2, gramWeight: 100 },
    { id: 11, modifier: "cup", amount: 1, gramWeight: 200 },
  ],
};
describe("USDA nutrition normalization", () => {
  it("uses source kcal and accepts explicit zero", () =>
    expect(normalizeFood(food)).toMatchObject({
      status: "included",
      per100g: { kcal: 100, fatG: 0 },
    }));
  it("converts kJ only when kcal is absent", () => {
    const row = normalizeFood({
      ...food,
      foodNutrients: food.foodNutrients.filter((x) => x.nutrient.id !== 1008),
    });
    if (row.status !== "included") throw Error("excluded fixture");
    expect(row.per100g.kcal).toBeCloseTo(100);
  });
  it("never substitutes zero for missing protein", () =>
    expect(
      normalizeFood({
        ...food,
        foodNutrients: food.foodNutrients.filter((x) => x.nutrient.id !== 1003),
      }).status,
    ).toBe("excluded"));
  it("exposes only approved whole edible portions", () => {
    const row = normalizeFood(food, [10]);
    if (row.status !== "included") throw Error("excluded fixture");
    expect(row.portions).toEqual([
      {
        sourcePortionId: "10",
        label: "large",
        quantity: 2,
        grams: 100,
        unitGrams: 50,
      },
    ]);
  });
  it("rejects nonfinite and wrong-unit core data", () =>
    expect(
      normalizeFood({
        ...food,
        foodNutrients: [
          ...food.foodNutrients.filter((x) => x.nutrient.id !== 1003),
          nutrient(1003, "mg", 12),
        ],
      }).status,
    ).toBe("excluded"));
});
