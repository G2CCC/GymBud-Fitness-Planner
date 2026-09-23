import type { CycleStatus } from "../enums";
import { startOfUtcDay } from "../scheduling/distribute-week";
import { startOfLocalDate } from "../time/timezone";

export type CycleReviewBlockedReason =
  | "BEFORE_REVIEW_DATE"
  | "PLANNED_WORKOUTS_REMAINING"
  | "CYCLE_NOT_ACTIVE";

export type CycleReviewStatusInput = {
  cycleStatus: CycleStatus;
  cycleEndDate: Date;
  now: Date;
  timezone: string;
  plannedWorkoutCount: number;
};

export type CycleReviewStatus = {
  reviewRequired: boolean;
  reviewAvailable: boolean;
  today: Date;
  reviewAvailableOn: Date;
  daysUntilReview: number;
  plannedWorkoutCount: number;
  blockedReason: CycleReviewBlockedReason | null;
};

/**
 * Determines whether the client should show the end-of-cycle review prompt.
 * The cycle remains ACTIVE until the user explicitly completes that review.
 */
export function getCycleReviewStatus(
  input: CycleReviewStatusInput,
): CycleReviewStatus {
  const today = startOfLocalDate(input.now, input.timezone);
  const reviewAvailableOn = startOfUtcDay(input.cycleEndDate);
  const daysUntilReview = Math.max(
    0,
    Math.round(
      (reviewAvailableOn.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
    ),
  );

  if (input.cycleStatus !== "ACTIVE") {
    return {
      reviewRequired: false,
      reviewAvailable: false,
      today,
      reviewAvailableOn,
      daysUntilReview,
      plannedWorkoutCount: input.plannedWorkoutCount,
      blockedReason: "CYCLE_NOT_ACTIVE",
    };
  }

  if (daysUntilReview > 0) {
    return {
      reviewRequired: false,
      reviewAvailable: false,
      today,
      reviewAvailableOn,
      daysUntilReview,
      plannedWorkoutCount: input.plannedWorkoutCount,
      blockedReason: "BEFORE_REVIEW_DATE",
    };
  }

  if (input.plannedWorkoutCount > 0) {
    return {
      reviewRequired: false,
      reviewAvailable: false,
      today,
      reviewAvailableOn,
      daysUntilReview,
      plannedWorkoutCount: input.plannedWorkoutCount,
      blockedReason: "PLANNED_WORKOUTS_REMAINING",
    };
  }

  return {
    reviewRequired: true,
    reviewAvailable: true,
    today,
    reviewAvailableOn,
    daysUntilReview,
    plannedWorkoutCount: input.plannedWorkoutCount,
    blockedReason: null,
  };
}
