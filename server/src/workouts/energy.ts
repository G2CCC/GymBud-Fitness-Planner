import { Prisma } from "@prisma/client";
import {
  estimateDurationEnergy,
  estimateStrengthEnergy,
  nutritionLocalDate,
  NutritionError,
  type EnergyEstimate,
} from "@fitness/shared";
import { activityEnergy } from "../catalog/activity-energy";
import { isStrengthEnergySupported } from "../catalog/strength-energy";
import { ensureNutritionDay } from "../nutrition/context";

export const energySelect = {
  estimatedCaloriesKcal: true,
  energyCoverage: true,
  energyMethod: true,
  energyVersion: true,
  energyInputs: true,
  completedLocalDate: true,
  timezone: true,
} as const;
export function energyDto(
  log: {
    estimatedCaloriesKcal: number | null;
    energyCoverage: string | null;
    energyMethod: string | null;
    energyVersion: string | null;
    energyInputs: Prisma.JsonValue | null;
  } | null,
): EnergyEstimate | null {
  if (!log?.energyVersion) return null;
  return {
    estimatedKcal: log.estimatedCaloriesKcal,
    coverage: log.energyCoverage as EnergyEstimate["coverage"],
    method: log.energyMethod as EnergyEstimate["method"],
    version: log.energyVersion as EnergyEstimate["version"],
    inputs: log.energyInputs as Record<string, unknown>,
  };
}
export async function snapshotWorkoutEnergy(
  tx: Prisma.TransactionClient,
  userId: string,
  workoutId: string,
  reassignDate = false,
) {
  const workout = await tx.scheduledWorkout.findUniqueOrThrow({
    where: { id: workoutId },
    include: {
      plannedExercises: true,
      workoutLog: { include: { exerciseLogs: { include: { setLogs: true } } } },
    },
  });
  const profile = await tx.userProfile.findUnique({ where: { userId } }),
    log = workout.workoutLog;
  if (!profile || !log)
    throw new NutritionError("Save your profile and actual workout log first");
  const previous = log.energyInputs as Record<string, unknown> | null;
  const bodyWeightKg =
    typeof previous?.bodyWeightKg === "number"
      ? previous.bodyWeightKg
      : profile.weightKg;
  let estimate: EnergyEstimate;
  if (workout.activityType === "STRENGTH") {
    estimate = estimateStrengthEnergy(
      log.exerciseLogs.map((ex) => ({
        exerciseId: ex.exerciseId,
        supported: isStrengthEnergySupported(ex.exerciseId),
        sets: ex.setLogs,
        restSeconds:
          workout.plannedExercises.find(
            (p) =>
              p.exerciseId === ex.exerciseId && p.sortOrder === ex.sortOrder,
          )?.restSeconds ?? 60,
      })),
      bodyWeightKg,
    );
  } else {
    const reference = activityEnergy[workout.activityOptionId ?? ""];
    const details = log.actualDetails as { actualDurationMinutes: number };
    estimate = estimateDurationEnergy({
      activityId: workout.activityOptionId ?? "unknown",
      minutes: details.actualDurationMinutes,
      bodyWeightKg,
      met: reference?.met ?? null,
      referenceCode: reference?.referenceCode ?? null,
    });
    estimate.inputs.assumption =
      reference?.assumption ?? "No reviewed energy estimate";
    estimate.inputs.source = reference?.source ?? null;
  }
  let timezone = log.timezone,
    completedLocalDate = log.completedLocalDate;
  if (
    workout.status === "COMPLETED" &&
    workout.completedAt &&
    (reassignDate || !completedLocalDate)
  ) {
    timezone = log.timezone ?? profile.recordingTimezone;
    const candidate = nutritionLocalDate(workout.completedAt, timezone);
    const day = await ensureNutritionDay(tx, userId, candidate, timezone);
    if (nutritionLocalDate(workout.completedAt, day.timezone) !== candidate)
      throw new NutritionError(
        "Completion time conflicts with this day’s saved timezone. Choose a different completion time.",
      );
    timezone = day.timezone;
    completedLocalDate = candidate;
  }
  await tx.workoutLog.update({
    where: { id: log.id },
    data: {
      estimatedCaloriesKcal: estimate.estimatedKcal,
      energyCoverage: estimate.coverage,
      energyMethod: estimate.method,
      energyVersion: estimate.version,
      energyInputs: {
        ...estimate.inputs,
        bodyWeightSource: "PROFILE_AT_LOGGING",
      } as Prisma.InputJsonValue,
      timezone,
      completedLocalDate,
    },
  });
}
