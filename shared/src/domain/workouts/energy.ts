import { NutritionError, type EnergyEstimate } from "../nutrition/types";
export type StrengthEnergyItem = {
  exerciseId: string;
  supported: boolean;
  restSeconds?: number | null;
  sets: Array<{ actualReps: number }>;
};
function positive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0)
    throw new NutritionError(`Invalid ${label}`);
}
export function estimateStrengthEnergy(
  items: StrengthEnergyItem[],
  bodyWeightKg: number,
): EnergyEstimate {
  positive(bodyWeightKg, "body weight");
  const actions = items.map((item) => {
    const rest = item.restSeconds ?? 60;
    if (
      !Number.isFinite(rest) ||
      rest < 0 ||
      item.sets.some((s) => !Number.isInteger(s.actualReps) || s.actualReps < 0)
    )
      throw new NutritionError("Invalid actual repetitions or rest");
    const sets = item.sets.filter((s) => s.actualReps > 0);
    const reps = sets.reduce((sum, s) => sum + s.actualReps, 0);
    const estimatedSeconds = reps * 4 + Math.max(sets.length - 1, 0) * rest;
    return {
      exerciseId: item.exerciseId,
      supported: item.supported,
      reps,
      validSets: sets.length,
      restSeconds: rest,
      estimatedSeconds: item.supported ? estimatedSeconds : null,
      unroundedKcal: item.supported
        ? (2.5 * bodyWeightKg * estimatedSeconds) / 3600
        : null,
    };
  });
  const supported = actions.filter((a) => a.supported);
  return {
    estimatedKcal: supported.length
      ? Math.round(supported.reduce((sum, a) => sum + a.unroundedKcal!, 0))
      : null,
    coverage:
      supported.length === actions.length && actions.length > 0
        ? "COMPLETE"
        : supported.length
          ? "PARTIAL"
          : "UNAVAILABLE",
    method: "STRENGTH_REPS",
    version: "strength-energy-v1",
    inputs: {
      bodyWeightKg,
      met: 3.5,
      referenceCode: "02054",
      repSeconds: 4,
      actions,
    },
  };
}
export function estimateDurationEnergy(input: {
  activityId: string;
  minutes: number;
  met: number | null;
  bodyWeightKg: number;
  referenceCode: string | null;
}): EnergyEstimate {
  positive(input.bodyWeightKg, "body weight");
  positive(input.minutes, "actual duration");
  if (input.met !== null) positive(input.met, "MET");
  return {
    estimatedKcal:
      input.met === null
        ? null
        : Math.round(
            (Math.max(0, input.met - 1) * input.bodyWeightKg * input.minutes) /
              60,
          ),
    coverage: input.met === null ? "UNAVAILABLE" : "COMPLETE",
    method: "ACTIVITY_DURATION",
    version: "duration-energy-v1",
    inputs: { ...input },
  };
}
