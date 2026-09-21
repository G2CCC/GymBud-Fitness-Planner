import type { ActivityType, WeightUnit, WorkoutStatus } from "../enums";

export type CycleTrainingSetInput = { actualReps: number; actualWeight: number; weightUnit: WeightUnit };
export type CycleTrainingWorkoutInput = {
  id: string;
  activityType: ActivityType;
  status: WorkoutStatus;
  actualDetails?: { actualDurationMinutes?: number | null; distanceKm?: number | null } | null;
  actualExercises?: Array<{ sets: CycleTrainingSetInput[] }>;
};
export type CycleTrainingVolumeInput = { cycleId: string; startDate: Date; endDate: Date; workouts: CycleTrainingWorkoutInput[] };
export type WeightedVolume = Record<WeightUnit, number>;
export type CycleTrainingVolume = {
  cycleId: string;
  startDate: string;
  endDate: string;
  completedWorkoutCount: number;
  strength: { completedWorkoutCount: number; completedSetCount: number; actualRepCount: number; unweightedRepCount: number; weightedVolume: WeightedVolume };
  cardio: { completedWorkoutCount: number; actualDurationMinutes: number; actualDistanceKm: number };
  sport: { completedWorkoutCount: number; actualDurationMinutes: number };
};
export type CycleTrainingVolumeComparison = {
  completedWorkoutCountDelta: number;
  strength: { completedSetCountDelta: number; actualRepCountDelta: number; unweightedRepCountDelta: number; weightedVolumeDelta: WeightedVolume };
  cardio: { actualDurationMinutesDelta: number; actualDistanceKmDelta: number };
  sport: { actualDurationMinutesDelta: number };
};

export function buildCycleTrainingVolume(input: CycleTrainingVolumeInput): CycleTrainingVolume {
  const completed = input.workouts.filter((workout) => workout.status === "COMPLETED");
  const strengthWorkouts = completed.filter((workout) => workout.activityType === "STRENGTH");
  const cardioWorkouts = completed.filter((workout) => workout.activityType === "CARDIO");
  const sportWorkouts = completed.filter((workout) => workout.activityType === "SPORT");
  const sets = strengthWorkouts.flatMap((workout) => (workout.actualExercises ?? []).flatMap((exercise) => exercise.sets));
  const weightedVolume: WeightedVolume = { KG: 0, LB: 0 };
  for (const set of sets) weightedVolume[set.weightUnit] += set.actualWeight * set.actualReps;
  return {
    cycleId: input.cycleId,
    startDate: input.startDate.toISOString(),
    endDate: input.endDate.toISOString(),
    completedWorkoutCount: completed.length,
    strength: {
      completedWorkoutCount: strengthWorkouts.length,
      completedSetCount: sets.length,
      actualRepCount: sets.reduce((sum, set) => sum + set.actualReps, 0),
      unweightedRepCount: sets.reduce((sum, set) => sum + (set.actualWeight === 0 ? set.actualReps : 0), 0),
      weightedVolume,
    },
    cardio: {
      completedWorkoutCount: cardioWorkouts.length,
      actualDurationMinutes: cardioWorkouts.reduce((sum, workout) => sum + (workout.actualDetails?.actualDurationMinutes ?? 0), 0),
      actualDistanceKm: cardioWorkouts.reduce((sum, workout) => sum + (workout.actualDetails?.distanceKm ?? 0), 0),
    },
    sport: {
      completedWorkoutCount: sportWorkouts.length,
      actualDurationMinutes: sportWorkouts.reduce((sum, workout) => sum + (workout.actualDetails?.actualDurationMinutes ?? 0), 0),
    },
  };
}

export function compareCycleTrainingVolume(current: CycleTrainingVolume, previous: CycleTrainingVolume): CycleTrainingVolumeComparison {
  return {
    completedWorkoutCountDelta: current.completedWorkoutCount - previous.completedWorkoutCount,
    strength: {
      completedSetCountDelta: current.strength.completedSetCount - previous.strength.completedSetCount,
      actualRepCountDelta: current.strength.actualRepCount - previous.strength.actualRepCount,
      unweightedRepCountDelta: current.strength.unweightedRepCount - previous.strength.unweightedRepCount,
      weightedVolumeDelta: { KG: current.strength.weightedVolume.KG - previous.strength.weightedVolume.KG, LB: current.strength.weightedVolume.LB - previous.strength.weightedVolume.LB },
    },
    cardio: {
      actualDurationMinutesDelta: current.cardio.actualDurationMinutes - previous.cardio.actualDurationMinutes,
      actualDistanceKmDelta: current.cardio.actualDistanceKm - previous.cardio.actualDistanceKm,
    },
    sport: { actualDurationMinutesDelta: current.sport.actualDurationMinutes - previous.sport.actualDurationMinutes },
  };
}
