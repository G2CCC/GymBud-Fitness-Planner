import {
  NutritionError,
  type FoodSnapshot,
  type FoodUnit,
  type NutritionTotals,
} from "./types";
export function calculateFoodPortion(
  snapshot: FoodSnapshot,
  unit: FoodUnit,
  quantity: number,
): { grams: number; totals: NutritionTotals } {
  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !["g", "ea"].includes(unit)
  )
    throw new NutritionError("Enter a positive food quantity");
  if (
    unit === "ea" &&
    (!snapshot.unitGrams ||
      !Number.isFinite(snapshot.unitGrams) ||
      snapshot.unitGrams <= 0)
  )
    throw new NutritionError("This food has no verified each portion");
  const grams = unit === "g" ? quantity : quantity * snapshot.unitGrams!;
  const scale = (value: number) => {
    const n = (value * grams) / 100;
    if (!Number.isFinite(n) || n < 0 || n >= 1e10)
      throw new NutritionError("Food quantity exceeds the supported range");
    return n;
  };
  if (!Number.isFinite(grams) || grams >= 1e10)
    throw new NutritionError("Food quantity exceeds the supported range");
  return {
    grams,
    totals: {
      kcal: scale(snapshot.per100g.kcal),
      proteinG: scale(snapshot.per100g.proteinG),
      carbsG: scale(snapshot.per100g.carbsG),
      fatG: scale(snapshot.per100g.fatG),
    },
  };
}
