import { describe, it, expect } from "vitest";
import { summarizeNutritionDay } from "../../src/domain/nutrition/day";
import type { FoodEntry, TargetValues } from "../../src/domain/nutrition/types";
describe("daily nutrition arithmetic", () => {
  it("derives net and remaining while leaving macros independent of exercise", () => {
    const entries = [
      { totals: { kcal: 2000, proteinG: 100, carbsG: 300, fatG: 44 } },
    ] as FoodEntry[];
    const target = {
      kcal: 1939,
      proteinG: 144,
      carbsG: 195.3,
      fatG: 64.6,
      algorithmVersion: "nutrition-v1",
    } as TargetValues;
    expect(
      summarizeNutritionDay({
        entries,
        target,
        exercise: { estimatedKcal: 300, coverage: "COMPLETE", workouts: [] },
      }),
    ).toEqual({ food: entries[0].totals, netKcal: 1700, remainingKcal: 239 });
    expect(
      summarizeNutritionDay({
        entries: [],
        target: null,
        exercise: { estimatedKcal: 300, coverage: "PARTIAL", workouts: [] },
      }),
    ).toMatchObject({ netKcal: -300, remainingKcal: null });
  });
});
