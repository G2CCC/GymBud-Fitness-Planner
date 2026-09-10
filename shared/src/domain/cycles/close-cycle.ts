import type {
  CancellationReason,
  CycleStatus,
  WorkoutStatus,
} from "../enums";

export type CycleCloseWorkout = {
  id: string;
  status: WorkoutStatus;
  completedAt?: Date | null;
  cancellationReason?: CancellationReason | null;
};

export type CloseCycleInput = {
  cycleId: string;
  cycleStatus: CycleStatus;
  workouts: CycleCloseWorkout[];
};

export type CycleObjectiveSummary = {
  totalWorkouts: number;
  completedWorkouts: number;
  cancelledWorkoutsBeforeClose: number;
  unresolvedWorkouts: number;
  autoCancelledWorkouts: number;
};

export type CloseCycleResult = {
  cycleId: string;
  cycleStatus: Extract<CycleStatus, "CLOSED" | "PAUSED">;
  cancelledWorkoutIds: string[];
  workoutUpdates: Array<{
    id: string;
    status: "CANCELLED";
    cancellationReason: "AUTO_CYCLE_CLOSE";
  }>;
  objectiveSummary: CycleObjectiveSummary;
  nextCycleMayBeGenerated: boolean;
  restoreableWorkoutIds: string[];
};

export type RestoreAutoCancelledWorkoutInput = {
  cycleStatus: CycleStatus;
  hasNextCycle: boolean;
  workout: Pick<CycleCloseWorkout, "status" | "cancellationReason">;
  newScheduledDate: Date;
};

export function closeCycle(
  input: CloseCycleInput,
  now: Date,
): CloseCycleResult {
  if (input.cycleStatus !== "ACTIVE") {
    throw new Error("Only an ACTIVE cycle can be closed");
  }

  assertValidDate(now, "now");

  for (const workout of input.workouts) {
    if (workout.status === "COMPLETED") {
      assertCompletionTimestamp(workout.completedAt, now);
    }
  }

  const completedWorkouts = input.workouts.filter(
    (workout) => workout.status === "COMPLETED",
  );
  const cancelledWorkouts = input.workouts.filter(
    (workout) => workout.status === "CANCELLED",
  );
  const unresolvedWorkouts = input.workouts.filter(
    (workout) => workout.status === "PLANNED",
  );
  const cancelledWorkoutIds = unresolvedWorkouts.map((workout) => workout.id);
  const cycleStatus = completedWorkouts.length > 0 ? "CLOSED" : "PAUSED";

  return {
    cycleId: input.cycleId,
    cycleStatus,
    cancelledWorkoutIds,
    workoutUpdates: unresolvedWorkouts.map((workout) => ({
      id: workout.id,
      status: "CANCELLED" as const,
      cancellationReason: "AUTO_CYCLE_CLOSE" as const,
    })),
    objectiveSummary: {
      totalWorkouts: input.workouts.length,
      completedWorkouts: completedWorkouts.length,
      cancelledWorkoutsBeforeClose: cancelledWorkouts.length,
      unresolvedWorkouts: unresolvedWorkouts.length,
      autoCancelledWorkouts: unresolvedWorkouts.length,
    },
    nextCycleMayBeGenerated: completedWorkouts.length > 0,
    restoreableWorkoutIds: cancelledWorkoutIds,
  };
}

export function restoreAutoCancelledWorkout(
  input: RestoreAutoCancelledWorkoutInput,
): {
  status: "PLANNED";
  cancellationReason: null;
  scheduledDate: Date;
} {
  if (input.hasNextCycle) {
    throw new Error("The cycle is read-only after the next cycle exists");
  }

  if (input.cycleStatus !== "CLOSED" && input.cycleStatus !== "PAUSED") {
    throw new Error("Only a closed or paused cycle can restore a workout");
  }

  if (
    input.workout.status !== "CANCELLED" ||
    input.workout.cancellationReason !== "AUTO_CYCLE_CLOSE"
  ) {
    throw new Error("Only an auto-cancelled workout can be restored");
  }

  assertValidDate(input.newScheduledDate, "new scheduled date");

  return {
    status: "PLANNED",
    cancellationReason: null,
    scheduledDate: input.newScheduledDate,
  };
}

export function assertCycleWritable(
  cycleStatus: CycleStatus,
  hasNextCycle: boolean,
): void {
  if (hasNextCycle || cycleStatus !== "ACTIVE") {
    throw new Error("The cycle does not accept normal workout writes");
  }
}

function assertCompletionTimestamp(
  completedAt: Date | null | undefined,
  now: Date,
): void {
  if (!completedAt) {
    throw new Error("completedAt is required for completed workouts");
  }

  assertValidDate(completedAt, "completedAt");

  if (completedAt.getTime() > now.getTime()) {
    throw new Error("completedAt cannot be in the future");
  }
}

function assertValidDate(date: Date, label: string): void {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError(`${label} must be a valid Date`);
  }
}
