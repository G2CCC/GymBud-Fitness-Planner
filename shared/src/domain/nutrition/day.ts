import {
  emptyNutrition,
  type DayEnergy,
  type FoodEntry,
  type TargetValues,
} from "./types";
export function summarizeNutritionDay(input: {
  entries: FoodEntry[];
  target: TargetValues | null;
  exercise: DayEnergy;
}) {
  const food = input.entries.reduce(
    (sum, e) => ({
      kcal: sum.kcal + e.totals.kcal,
      proteinG: sum.proteinG + e.totals.proteinG,
      carbsG: sum.carbsG + e.totals.carbsG,
      fatG: sum.fatG + e.totals.fatG,
    }),
    emptyNutrition(),
  );
  const netKcal = food.kcal - input.exercise.estimatedKcal;
  return {
    food,
    netKcal,
    remainingKcal: input.target ? input.target.kcal - netKcal : null,
  };
}
