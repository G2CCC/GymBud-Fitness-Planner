import type {
  CancellationReason,
  CycleStatus,
  Location,
  WorkoutStatus,
} from "../enums";

export type WorkoutTransition = {
  id: string;
  status: WorkoutStatus;
  cycleStatus: CycleStatus;
  hasNextCycle: boolean;
  scheduledDate: Date;
  location: Location;
  completedAt?: Date | null;
  cancellationReason?: CancellationReason | null;
};

export type CompleteWorkoutInput = {
  completedAt?: Date;
};

export type CompletedWorkout = Omit<
  WorkoutTransition,
  "status" | "completedAt" | "cancellationReason"
> & {
  status: "COMPLETED";
  completedAt: Date;
  cancellationReason: null;
};

export type CancelledWorkout = Omit<
  WorkoutTransition,
  "status" | "completedAt" | "cancellationReason"
> & {
  status: "CANCELLED";
  completedAt: null;
  cancellationReason: "USER";
};

export type PlannedWorkout = Omit<
  WorkoutTransition,
  "status" | "completedAt" | "cancellationReason"
> & {
  status: "PLANNED";
  completedAt: null;
  cancellationReason: null;
};

export function completeWorkout(
  workout: WorkoutTransition,
  input: CompleteWorkoutInput,
  now: Date,
): CompletedWorkout {
  assertWritablePlannedWorkout(workout);
  assertValidDate(now, "now");

  const completedAt = input.completedAt ?? now;
  validateCompletionTimestamp(completedAt, now);

  return {
    ...workout,
    status: "COMPLETED",
    completedAt,
    cancellationReason: null,
  };
}

export function cancelWorkout(workout: WorkoutTransition): CancelledWorkout {
  assertWritablePlannedWorkout(workout);

  return {
    ...workout,
    status: "CANCELLED",
    completedAt: null,
    cancellationReason: "USER",
  };
}

export function rescheduleWorkout(
  workout: WorkoutTransition,
  newScheduledDate: Date,
): PlannedWorkout {
  assertWritablePlannedWorkout(workout);
  assertValidDate(newScheduledDate, "new scheduled date");

  return {
    ...workout,
    status: "PLANNED",
    scheduledDate: newScheduledDate,
    completedAt: null,
    cancellationReason: null,
  };
}

export function updateWorkoutLocation(
  workout: WorkoutTransition,
  location: Location,
): PlannedWorkout {
  assertWritablePlannedWorkout(workout);

  return {
    ...workout,
    status: "PLANNED",
    location,
    completedAt: null,
    cancellationReason: null,
  };
}

export function validateCompletionTimestamp(
  completedAt: Date,
  now: Date,
): void {
  assertValidDate(completedAt, "completedAt");
  assertValidDate(now, "now");

  if (completedAt.getTime() > now.getTime()) {
    throw new Error("completedAt cannot be in the future");
  }
}

function assertWritablePlannedWorkout(workout: WorkoutTransition): void {
  if (workout.cycleStatus !== "ACTIVE" || workout.hasNextCycle) {
    throw new Error("The cycle does not accept normal workout writes");
  }

  if (workout.status !== "PLANNED") {
    throw new Error("Only a planned workout can receive this state change");
  }
}

function assertValidDate(date: Date, label: string): void {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError(`${label} must be a valid Date`);
  }
}
