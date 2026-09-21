import type { ApiCycle, ApiWorkout } from "../../api/contracts";
import {
  buildProgressSummary,
  type ProgressSummary,
} from "../progress/progress-model";

export type TodayViewModel =
  | { kind: "NO_CYCLE" }
  | { kind: "DRAFT"; cycle: ApiCycle }
  | {
      kind: "REVIEW_REQUIRED";
      cycle: ApiCycle;
      reviewLabel: string;
      todayWorkouts: ApiWorkout[];
      summary: ProgressSummary;
    }
  | {
      kind: "READY";
      cycle: ApiCycle;
      todayWorkouts: ApiWorkout[];
      focusWorkout: ApiWorkout | null;
      summary: ProgressSummary;
    }
  | { kind: "CLOSED"; cycle: ApiCycle; summary: ProgressSummary };

export function systemDateKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return [values.year, values.month, values.day]
    .map((part) => part?.padStart(2, "0"))
    .join("-");
}

export function dateKeyFromIso(value: string): string {
  return value.slice(0, 10);
}

export function formatDateKey(value: string): string {
  const [year, month, day] = dateKeyFromIso(value).split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function buildTodayViewModel(
  cycle: ApiCycle | null,
  now = new Date(),
): TodayViewModel {
  if (!cycle) {
    return { kind: "NO_CYCLE" };
  }

  if (cycle.status === "DRAFT") {
    return { kind: "DRAFT", cycle };
  }

  const summary = buildProgressSummary(cycle.workouts);
  const todayKey = systemDateKey(now);
  const todayWorkouts = cycle.workouts.filter(
    (workout) => dateKeyFromIso(workout.scheduledDate) === todayKey,
  );

  if (hasDueReview(cycle)) {
    return {
      kind: "REVIEW_REQUIRED",
      cycle,
      reviewLabel: getReviewLabel(cycle),
      todayWorkouts,
      summary,
    };
  }

  if (cycle.status === "CLOSED") {
    return { kind: "CLOSED", cycle, summary };
  }

  return {
    kind: "READY",
    cycle,
    todayWorkouts,
    focusWorkout: selectFocusWorkout(cycle.workouts, todayWorkouts, todayKey),
    summary,
  };
}

function hasDueReview(cycle: ApiCycle): boolean {
  return (
    cycle.reviewStatus?.reviewRequired === true ||
    cycle.reviewAvailable === true ||
    cycle.weeklyReview != null
  );
}

function getReviewLabel(cycle: ApiCycle): string {
  return "Review this week";
}

function selectFocusWorkout(
  workouts: readonly ApiWorkout[],
  todayWorkouts: readonly ApiWorkout[],
  todayKey: string,
): ApiWorkout | null {
  const plannedToday = todayWorkouts.filter(
    (workout) => workout.status === "PLANNED",
  );
  if (plannedToday.length > 0) {
    return plannedToday[0];
  }

  if (todayWorkouts.length > 0) {
    return null;
  }

  const planned = workouts.filter((workout) => workout.status === "PLANNED");
  const future = planned
    .filter((workout) => dateKeyFromIso(workout.scheduledDate) > todayKey)
    .sort(compareScheduledDates);
  if (future.length > 0) {
    return future[0];
  }

  const overdue = planned
    .filter((workout) => dateKeyFromIso(workout.scheduledDate) < todayKey)
    .sort(compareScheduledDates);
  return overdue[0] ?? null;
}

function compareScheduledDates(left: ApiWorkout, right: ApiWorkout): number {
  return (
    dateKeyFromIso(left.scheduledDate).localeCompare(
      dateKeyFromIso(right.scheduledDate),
    )
  );
}
