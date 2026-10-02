import type { LocalDate, NutritionDayDto, NutritionTotals } from "./types";
import { localDateSchema } from "./validation";
export type NutritionWindow = { startDate: LocalDate; endDate: LocalDate };
export type NutritionSummary = NutritionWindow & {
  version: "nutrition-summary-v1";
  generatedAt: string;
  periodDays: number;
  completeFoodDays: number;
  targetDays: number;
  netComparableDays: number;
  averageFood: NutritionTotals | null;
  averageMacroGap: Omit<NutritionTotals, "kcal"> | null;
  averageNetKcal: number | null;
  averageNetGapKcal: number | null;
  trendEligible: boolean;
  coverageGaps: LocalDate[];
};
export type NutritionComparison = {
  foodKcalDelta: number | null;
  netGapKcalDelta: number | null;
  current: { foodDays: number; netDays: number };
  previous: { foodDays: number; netDays: number };
};
export function nutritionDateRange(window: NutritionWindow): string[] {
  const start = new Date(
      localDateSchema.parse(window.startDate) + "T00:00:00Z",
    ).getTime(),
    end = new Date(
      localDateSchema.parse(window.endDate) + "T00:00:00Z",
    ).getTime();
  const length = (end - start) / 86400000 + 1;
  if (length < 1 || length > 3660)
    throw new Error("Invalid nutrition date window");
  return Array.from({ length }, (_, i) =>
    new Date(start + i * 86400000).toISOString().slice(0, 10),
  );
}
export function buildNutritionSummary(
  days: NutritionDayDto[],
  window: NutritionWindow,
  generatedAt: string,
): NutritionSummary {
  const dates = new Set(nutritionDateRange(window));
  const within = days.filter((d) => dates.has(d.date)),
    complete = within.filter((d) => d.completedAt !== null),
    target = complete.filter((d) => d.target !== null),
    net = target.filter((d) => d.exercise.coverage === "COMPLETE");
  const mean = (
    rows: NutritionDayDto[],
    value: (d: NutritionDayDto) => number,
  ) =>
    rows.length
      ? rows.reduce((sum, d) => sum + value(d), 0) / rows.length
      : null;
  return {
    ...window,
    version: "nutrition-summary-v1",
    generatedAt,
    periodDays: dates.size,
    completeFoodDays: complete.length,
    targetDays: target.length,
    netComparableDays: net.length,
    averageFood: complete.length
      ? {
          kcal: mean(complete, (d) => d.food.kcal)!,
          proteinG: mean(complete, (d) => d.food.proteinG)!,
          carbsG: mean(complete, (d) => d.food.carbsG)!,
          fatG: mean(complete, (d) => d.food.fatG)!,
        }
      : null,
    averageMacroGap: target.length
      ? {
          proteinG: mean(target, (d) => d.food.proteinG - d.target!.proteinG)!,
          carbsG: mean(target, (d) => d.food.carbsG - d.target!.carbsG)!,
          fatG: mean(target, (d) => d.food.fatG - d.target!.fatG)!,
        }
      : null,
    averageNetKcal: mean(net, (d) => d.netKcal),
    averageNetGapKcal: mean(net, (d) => d.netKcal - d.target!.kcal),
    trendEligible: complete.length >= 3,
    coverageGaps: within
      .filter((d) => d.exercise.coverage !== "COMPLETE")
      .map((d) => d.date)
      .sort(),
  };
}
export function compareNutrition(
  current: NutritionSummary,
  previous: NutritionSummary | null,
): NutritionComparison | null {
  if (!previous) return null;
  return {
    current: {
      foodDays: current.completeFoodDays,
      netDays: current.netComparableDays,
    },
    previous: {
      foodDays: previous.completeFoodDays,
      netDays: previous.netComparableDays,
    },
    foodKcalDelta:
      current.averageFood && previous.averageFood
        ? current.averageFood.kcal - previous.averageFood.kcal
        : null,
    netGapKcalDelta:
      current.averageNetGapKcal !== null && previous.averageNetGapKcal !== null
        ? current.averageNetGapKcal - previous.averageNetGapKcal
        : null,
  };
}
