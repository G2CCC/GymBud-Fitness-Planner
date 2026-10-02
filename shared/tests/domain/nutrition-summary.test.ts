import { describe, it, expect } from "vitest";
import {
  buildNutritionSummary,
  compareNutrition,
} from "../../src/domain/nutrition/summary";
import type { NutritionDayDto } from "../../src/domain/nutrition/types";
const window = { startDate: "2026-09-21", endDate: "2026-09-27" },
  at = "2026-09-29T00:00:00Z";
function day(
  date: string,
  complete = true,
  kcal = 2000,
  target: number | null = 1900,
  coverage: "COMPLETE" | "PARTIAL" = "COMPLETE",
): NutritionDayDto {
  return {
    date,
    timezone: "UTC",
    revision: 1,
    recorded: true,
    completedAt: complete ? at : null,
    entries: [],
    food: { kcal, proteinG: 100, carbsG: 300, fatG: 44 },
    target:
      target === null
        ? null
        : {
            kcal: target,
            proteinG: 100,
            carbsG: 300,
            fatG: 44,
            algorithmVersion: "nutrition-v1",
          },
    netKcal: kcal,
    remainingKcal: target === null ? null : target - kcal,
    exercise: { estimatedKcal: 0, coverage, workouts: [] },
  };
}
describe("cycle nutrition coverage", () => {
  it("uses each day target and excludes incomplete days and records after the cycle", () => {
    const result = buildNutritionSummary(
      [
        day("2026-09-21"),
        day("2026-09-22", true, 2000, 2000),
        day("2026-09-23", false, 9000),
        day("2026-09-28", true, 9000),
      ],
      window,
      at,
    );
    expect(result).toMatchObject({
      periodDays: 7,
      completeFoodDays: 2,
      targetDays: 2,
      netComparableDays: 2,
      averageFood: { kcal: 2000 },
      averageNetGapKcal: 50,
      trendEligible: false,
    });
  });
  it("keeps distinct food, target and net sample sets", () => {
    const result = buildNutritionSummary(
      [
        day("2026-09-21"),
        day("2026-09-22", true, 1000, null),
        day("2026-09-23", true, 3000, 2000, "PARTIAL"),
      ],
      window,
      at,
    );
    expect(result).toMatchObject({
      completeFoodDays: 3,
      targetDays: 2,
      netComparableDays: 1,
      trendEligible: true,
      averageFood: { kcal: 2000 },
      averageNetKcal: 2000,
      averageNetGapKcal: 100,
      coverageGaps: ["2026-09-23"],
    });
    expect(buildNutritionSummary([], window, at)).toMatchObject({
      averageFood: null,
      averageMacroGap: null,
      averageNetKcal: null,
      averageNetGapKcal: null,
    });
  });
  it("compares means and reports unequal sample counts", () => {
    const previous = buildNutritionSummary(
        [day("2026-09-21"), day("2026-09-22")],
        window,
        at,
      ),
      current = buildNutritionSummary(
        Array.from({ length: 7 }, (_, i) => day("2026-09-" + (21 + i))),
        window,
        at,
      );
    expect(compareNutrition(current, previous)).toMatchObject({
      foodKcalDelta: 0,
      netGapKcalDelta: 0,
      current: { foodDays: 7, netDays: 7 },
      previous: { foodDays: 2, netDays: 2 },
    });
    expect(compareNutrition(current, null)).toBeNull();
  });
});
