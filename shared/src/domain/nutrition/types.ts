import type { BodyGoal, Sex } from "../enums";
export type LocalDate = string;
export type NutritionTotals = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};
export type NutritionProfile = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  primaryGoal: BodyGoal;
};
export type TargetValues = NutritionTotals & {
  algorithmVersion: "nutrition-v1";
};
export type FoodUnit = "g" | "ea";
export type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
export type FoodSnapshot = {
  name: string;
  per100g: NutritionTotals;
  unitGrams: number | null;
};
export type EnergyCoverage = "COMPLETE" | "PARTIAL" | "UNAVAILABLE";
export type EnergyEstimate = {
  estimatedKcal: number | null;
  coverage: EnergyCoverage;
  method: "STRENGTH_REPS" | "ACTIVITY_DURATION";
  version: "strength-energy-v1" | "duration-energy-v1";
  inputs: Record<string, unknown>;
};
export type FoodDto = {
  id: string;
  name: string;
  per100g: NutritionTotals;
  portions: Array<{ id: string; label: string; unitGrams: number }>;
};
export type EntryInput = {
  date: LocalDate;
  mealType: MealType;
  foodId: string;
  portionId?: string;
  quantity: number;
  unit: FoodUnit;
  clientRequestId: string;
  expectedRevision: number;
};
export type EntryPatch = Pick<
  EntryInput,
  "mealType" | "quantity" | "unit" | "expectedRevision"
> & { foodId?: string; portionId?: string };
export type FoodEntry = {
  id: string;
  foodId: string;
  portionId: string | null;
  mealType: MealType;
  quantity: number;
  unit: FoodUnit;
  grams: number;
  snapshot: FoodSnapshot;
  totals: NutritionTotals;
};
export type DayEnergy = {
  estimatedKcal: number;
  coverage: EnergyCoverage;
  workouts: Array<{
    workoutId: string;
    estimatedKcal: number | null;
    coverage: EnergyCoverage;
  }>;
};
export type NutritionDayDto = {
  date: LocalDate;
  timezone: string;
  revision: number;
  completedAt: string | null;
  target: TargetValues | null;
  entries: FoodEntry[];
  food: NutritionTotals;
  exercise: DayEnergy;
  netKcal: number;
  remainingKcal: number | null;
  recorded: boolean;
};
export class NutritionError extends Error {
  constructor(
    message: string,
    readonly code = "VALIDATION_ERROR",
    readonly statusCode: 400 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "NutritionError";
  }
}
export const emptyNutrition = (): NutritionTotals => ({
  kcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
});
