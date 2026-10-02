import type { Food, FoodPortion, FoodLog } from "@prisma/client";
import {
  nutritionTotalsSchema,
  type FoodDto,
  type FoodEntry,
} from "@fitness/shared";
export function foodDto(row: Food & { portions: FoodPortion[] }): FoodDto {
  return {
    id: row.id,
    name: row.name,
    per100g: {
      kcal: Number(row.kcalPer100g),
      proteinG: Number(row.proteinPer100g),
      carbsG: Number(row.carbsPer100g),
      fatG: Number(row.fatPer100g),
    },
    portions: row.portions
      .filter((p) => p.active)
      .map((p) => ({
        id: p.id,
        label: p.label,
        unitGrams: Number(p.unitGrams),
      })),
  };
}
export function foodEntryDto(row: FoodLog): FoodEntry {
  return {
    id: row.id,
    foodId: row.foodId,
    portionId: row.portionId,
    mealType: row.mealType,
    quantity: Number(row.quantity),
    unit: row.unit as FoodEntry["unit"],
    grams: Number(row.grams),
    snapshot: {
      name: row.nameSnapshot,
      per100g: nutritionTotalsSchema.parse(row.per100gSnapshot),
      unitGrams:
        row.unitGramsSnapshot === null ? null : Number(row.unitGramsSnapshot),
    },
    totals: {
      kcal: Number(row.kcal),
      proteinG: Number(row.proteinG),
      carbsG: Number(row.carbsG),
      fatG: Number(row.fatG),
    },
  };
}
