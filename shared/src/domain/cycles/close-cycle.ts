import type { CycleStatus, WorkoutStatus } from "../enums";

export type CycleCloseWorkout = {
  id: string;
  status: WorkoutStatus;
  completedAt?: Date | null;
};

export type CloseCycleInput = {
  cycleId: string;
  cycleStatus: CycleStatus;
  workouts: CycleCloseWorkout[];
};

export type CycleObjectiveSummary = {
  totalWorkouts: number;
  completedWorkouts: number;
  unresolvedWorkouts: number;
};

export type NextCycleEligibility = "ELIGIBLE" | "RESET_REQUIRED";

export type CloseCycleResult = {
  cycleId: string;
  cycleStatus: "CLOSED";
  unresolvedWorkoutIds: string[];
  objectiveSummary: CycleObjectiveSummary;
  nextCycleMayBeGenerated: boolean;
  nextCycleEligibility: NextCycleEligibility;
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
  const unresolvedWorkouts = input.workouts.filter(
    (workout) => workout.status === "PLANNED",
  );
  const nextCycleMayBeGenerated = completedWorkouts.length > 0;

  return {
    cycleId: input.cycleId,
    cycleStatus: "CLOSED",
    unresolvedWorkoutIds: unresolvedWorkouts.map((workout) => workout.id),
    objectiveSummary: {
      totalWorkouts: input.workouts.length,
      completedWorkouts: completedWorkouts.length,
      unresolvedWorkouts: unresolvedWorkouts.length,
    },
    nextCycleMayBeGenerated,
    nextCycleEligibility: nextCycleMayBeGenerated
      ? "ELIGIBLE"
      : "RESET_REQUIRED",
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
