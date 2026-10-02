import {
  NutritionError,
  type NutritionProfile,
  type TargetValues,
} from "./types";
export function calculateNutritionTarget(
  profile: NutritionProfile,
): TargetValues {
  const { sex, age, heightCm, weightKg, primaryGoal } = profile;
  const factor = { FAT_LOSS: 0.9, MUSCLE_GAIN: 1.05, MAINTENANCE: 1 }[
    primaryGoal
  ];
  if (
    ![age, heightCm, weightKg].every((n) => Number.isFinite(n) && n > 0) ||
    !factor ||
    !["MALE", "FEMALE"].includes(sex)
  )
    throw new NutritionError(
      "Check your body details before calculating a target",
      "INVALID_TARGET",
    );
  const rest =
    10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "MALE" ? 5 : -161);
  const kcal = Math.round(rest * 1.2 * factor);
  const proteinG = weightKg * (primaryGoal === "MAINTENANCE" ? 1.6 : 1.8);
  const fatG = (kcal * 0.3) / 9;
  const carbsG = (kcal - 4 * proteinG - 9 * fatG) / 4;
  if (
    !Number.isFinite(kcal) ||
    kcal <= 0 ||
    ![proteinG, fatG, carbsG].every((n) => Number.isFinite(n) && n >= 0)
  )
    throw new NutritionError(
      "These body details do not produce a valid nutrition target",
      "INVALID_TARGET",
    );
  const tenth = (n: number) => Math.round(n * 10) / 10;
  return {
    kcal,
    proteinG: tenth(proteinG),
    fatG: tenth(fatG),
    carbsG: tenth(carbsG),
    algorithmVersion: "nutrition-v1",
  };
}
