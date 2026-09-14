import type {
  ActivityType,
  CancellationReason,
  WeightUnit,
  WorkoutSource,
  WorkoutStatus,
} from "../enums";

export type ObjectivePlannedSet = {
  setNumber: number;
  targetReps: number;
  plannedWeight: number | null;
  weightUnit: WeightUnit | null;
};

export type ObjectiveActualSet = {
  setNumber: number;
  actualReps: number;
  actualWeight: number | null;
  weightUnit: WeightUnit | null;
};

export type ObjectiveStrengthExercise = {
  exerciseId: string;
  plannedSets: ObjectivePlannedSet[];
  actualSets: ObjectiveActualSet[];
};

export type ObjectiveStrengthWorkout = {
  workoutId: string;
  status: WorkoutStatus;
  exercises: ObjectiveStrengthExercise[];
};

export type ObjectiveCardioWorkout = {
  workoutId: string;
  status: WorkoutStatus;
  plannedDurationMinutes: number;
  actualDurationMinutes: number | null;
  plannedDistanceKm: number | null;
  actualDistanceKm: number | null;
};

export type ObjectiveSportWorkout = {
  workoutId: string;
  status: WorkoutStatus;
  plannedDurationMinutes: number;
  actualDurationMinutes: number | null;
};

export type ObjectiveWorkoutCounts = {
  total: number;
  completed: number;
  cancelled: number;
  planned: number;
  completionRate: number;
};

export type ObjectiveCycleSummary = {
  cycleId: string;
  startDate: string;
  endDate: string;
  total: ObjectiveWorkoutCounts;
  original: ObjectiveWorkoutCounts;
  extra: ObjectiveWorkoutCounts;
  cancellations: {
    total: number;
    user: number;
    automatic: number;
  };
  rescheduleCount: number;
  strength: {
    workouts: ObjectiveStrengthWorkout[];
  };
  cardio: {
    workouts: ObjectiveCardioWorkout[];
    plannedDurationMinutes: number;
    actualDurationMinutes: number;
    plannedDistanceKm: number;
    actualDistanceKm: number;
  };
  sport: {
    workouts: ObjectiveSportWorkout[];
    plannedDurationMinutes: number;
    actualDurationMinutes: number;
  };
  zeroCompletedCycle: boolean;
  nextCycleEligibility: "ELIGIBLE" | "RESET_REQUIRED";
};

export type ObjectiveCycleSummaryInput = {
  cycleId: string;
  startDate: Date;
  endDate: Date;
  workouts: ObjectiveWorkoutInput[];
};

export type ObjectiveWorkoutInput = {
  id: string;
  source: WorkoutSource;
  activityType: ActivityType;
  status: WorkoutStatus;
  cancellationReason?: CancellationReason | null;
  durationMinutes: number;
  rescheduleCount: number;
  plannedDetails?: {
    distanceKm?: number;
  } | null;
  actualDetails?: {
    actualDurationMinutes?: number;
    distanceKm?: number;
  } | null;
  plannedExercises?: ObjectivePlannedExerciseInput[];
  actualExercises?: ObjectiveActualExerciseInput[];
};

export type ObjectivePlannedExerciseInput = {
  exerciseId: string;
  sets: ObjectivePlannedSet[];
};

export type ObjectiveActualExerciseInput = {
  exerciseId: string;
  sets: ObjectiveActualSet[];
};

/**
 * Builds the review payload from persisted workout facts only.
 *
 * This function intentionally accepts normalized input rather than Prisma
 * records. The server owns the database mapping, while web and future iOS
 * clients can share the resulting contract without importing server code.
 */
export function buildObjectiveCycleSummary(
  input: ObjectiveCycleSummaryInput,
): ObjectiveCycleSummary {
  const total = buildCounts(input.workouts);
  const original = buildCounts(
    input.workouts.filter((workout) => workout.source === "ORIGINAL"),
  );
  const extra = buildCounts(
    input.workouts.filter((workout) => workout.source === "EXTRA"),
  );

  const cancellations = input.workouts.reduce(
    (result, workout) => {
      if (workout.status !== "CANCELLED") {
        return result;
      }

      result.total += 1;
      if (workout.cancellationReason === "AUTO_CYCLE_CLOSE") {
        result.automatic += 1;
      } else if (workout.cancellationReason === "USER") {
        result.user += 1;
      }
      return result;
    },
    { total: 0, user: 0, automatic: 0 },
  );

  const strengthWorkouts = input.workouts
    .filter((workout) => workout.activityType === "STRENGTH")
    .map((workout) => ({
      workoutId: workout.id,
      status: workout.status,
      exercises: mergeStrengthExercises(workout),
    }));

  const cardioWorkouts = input.workouts
    .filter((workout) => workout.activityType === "CARDIO")
    .map((workout) => ({
      workoutId: workout.id,
      status: workout.status,
      plannedDurationMinutes: workout.durationMinutes,
      actualDurationMinutes: workout.actualDetails?.actualDurationMinutes ?? null,
      plannedDistanceKm: workout.plannedDetails?.distanceKm ?? null,
      actualDistanceKm: workout.actualDetails?.distanceKm ?? null,
    }));

  const sportWorkouts = input.workouts
    .filter((workout) => workout.activityType === "SPORT")
    .map((workout) => ({
      workoutId: workout.id,
      status: workout.status,
      plannedDurationMinutes: workout.durationMinutes,
      actualDurationMinutes: workout.actualDetails?.actualDurationMinutes ?? null,
    }));

  const actualDuration = (value: number | null) => value ?? 0;
  const actualDistance = (value: number | null) => value ?? 0;

  return {
    cycleId: input.cycleId,
    startDate: input.startDate.toISOString(),
    endDate: input.endDate.toISOString(),
    total,
    original,
    extra,
    cancellations,
    rescheduleCount: input.workouts.reduce(
      (sum, workout) => sum + workout.rescheduleCount,
      0,
    ),
    strength: { workouts: strengthWorkouts },
    cardio: {
      workouts: cardioWorkouts,
      plannedDurationMinutes: cardioWorkouts.reduce(
        (sum, workout) => sum + workout.plannedDurationMinutes,
        0,
      ),
      actualDurationMinutes: cardioWorkouts.reduce(
        (sum, workout) => sum + actualDuration(workout.actualDurationMinutes),
        0,
      ),
      plannedDistanceKm: cardioWorkouts.reduce(
        (sum, workout) => sum + (workout.plannedDistanceKm ?? 0),
        0,
      ),
      actualDistanceKm: cardioWorkouts.reduce(
        (sum, workout) => sum + actualDistance(workout.actualDistanceKm),
        0,
      ),
    },
    sport: {
      workouts: sportWorkouts,
      plannedDurationMinutes: sportWorkouts.reduce(
        (sum, workout) => sum + workout.plannedDurationMinutes,
        0,
      ),
      actualDurationMinutes: sportWorkouts.reduce(
        (sum, workout) => sum + actualDuration(workout.actualDurationMinutes),
        0,
      ),
    },
    zeroCompletedCycle: total.completed === 0,
    nextCycleEligibility: total.completed > 0 ? "ELIGIBLE" : "RESET_REQUIRED",
  };
}

function buildCounts(workouts: ObjectiveWorkoutInput[]): ObjectiveWorkoutCounts {
  const completed = workouts.filter(
    (workout) => workout.status === "COMPLETED",
  ).length;
  const cancelled = workouts.filter(
    (workout) => workout.status === "CANCELLED",
  ).length;
  const planned = workouts.filter(
    (workout) => workout.status === "PLANNED",
  ).length;
  const total = workouts.length;

  return {
    total,
    completed,
    cancelled,
    planned,
    completionRate: total === 0 ? 0 : completed / total,
  };
}

function mergeStrengthExercises(
  workout: ObjectiveWorkoutInput,
): ObjectiveStrengthExercise[] {
  const byExerciseId = new Map<string, ObjectiveStrengthExercise>();

  for (const exercise of workout.plannedExercises ?? []) {
    byExerciseId.set(exercise.exerciseId, {
      exerciseId: exercise.exerciseId,
      plannedSets: exercise.sets,
      actualSets: [],
    });
  }

  for (const exercise of workout.actualExercises ?? []) {
    const existing = byExerciseId.get(exercise.exerciseId);
    if (existing) {
      existing.actualSets = exercise.sets;
    } else {
      byExerciseId.set(exercise.exerciseId, {
        exerciseId: exercise.exerciseId,
        plannedSets: [],
        actualSets: exercise.sets,
      });
    }
  }

  return [...byExerciseId.values()];
}
