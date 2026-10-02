import type { NutritionTotals } from "@fitness/shared";
export type SourceFood = {
  fdcId: number;
  dataType: string;
  description: string;
  foodNutrients: Array<{
    nutrient: { id: number; unitName: string };
    amount?: number;
  }>;
  foodPortions?: Array<{
    id: number;
    modifier?: string;
    amount?: number;
    gramWeight?: number;
  }>;
};
export type NormalizedFood = {
  status: "included";
  sourceId: string;
  name: string;
  per100g: NutritionTotals;
  portions: Array<{
    sourcePortionId: string;
    label: string;
    quantity: number;
    grams: number;
    unitGrams: number;
  }>;
};
export type ExcludedFood = {
  status: "excluded";
  sourceId: string;
  reason: string;
};
export function normalizeFood(
  source: SourceFood,
  approvedPortionIds: readonly number[] = [],
): NormalizedFood | ExcludedFood {
  const excluded = (reason: string): ExcludedFood => ({
    status: "excluded",
    sourceId: String(source.fdcId),
    reason,
  });
  if (
    source.dataType !== "SR Legacy" ||
    !source.description ||
    !Number.isInteger(source.fdcId)
  )
    return excluded("invalid-source");
  const get = (id: number, unit: string) => {
    const matches = source.foodNutrients.filter(
      (n) => n.nutrient.id === id && n.nutrient.unitName.toLowerCase() === unit,
    );
    if (matches.length !== 1) return undefined;
    const value = matches[0].amount;
    return typeof value === "number" && Number.isFinite(value) && value >= 0
      ? value
      : undefined;
  };
  const hasKcal = source.foodNutrients.some((n) => n.nutrient.id === 1008);
  const kj = get(1062, "kj");
  const kcal = hasKcal
    ? get(1008, "kcal")
    : kj === undefined
      ? undefined
      : kj / 4.184;
  const proteinG = get(1003, "g"),
    fatG = get(1004, "g"),
    carbsG = get(1005, "g");
  if (
    kcal === undefined ||
    proteinG === undefined ||
    fatG === undefined ||
    carbsG === undefined
  )
    return excluded("missing-or-invalid-core-nutrient");
  const portions: NormalizedFood["portions"] = [];
  for (const p of source.foodPortions ?? []) {
    if (!approvedPortionIds.includes(p.id)) continue;
    if (
      !p.modifier ||
      /cup|slice|serving|tbsp|tsp|ounce|\boz\b/i.test(p.modifier) ||
      !p.amount ||
      !p.gramWeight ||
      !Number.isFinite(p.amount) ||
      !Number.isFinite(p.gramWeight) ||
      p.amount <= 0 ||
      p.gramWeight <= 0
    )
      return excluded("invalid-approved-each-portion");
    portions.push({
      sourcePortionId: String(p.id),
      label: p.modifier,
      quantity: p.amount,
      grams: p.gramWeight,
      unitGrams: p.gramWeight / p.amount,
    });
  }
  if (portions.length !== approvedPortionIds.length)
    return excluded("missing-approved-each-portion");
  return {
    status: "included",
    sourceId: String(source.fdcId),
    name: source.description,
    per100g: { kcal, proteinG, carbsG, fatG },
    portions,
  };
}
