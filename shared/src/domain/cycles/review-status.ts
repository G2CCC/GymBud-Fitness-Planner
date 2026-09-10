import type { CycleStatus } from "../enums";
import { startOfUtcDay } from "../scheduling/distribute-week";
import { startOfLocalDate } from "../time/timezone";

export type CycleReviewReason = "FINAL_DAY_ACTION" | "PAST_END_DATE";

export type CycleReviewStatusInput = {
  cycleStatus: CycleStatus;
  cycleEndDate: Date;
  now: Date;
  timezone: string;
  finalDayWorkoutsResolved?: boolean;
};

export type CycleReviewStatus =
  | {
      reviewRequired: false;
      today: Date;
    }
  | {
      reviewRequired: true;
      reason: CycleReviewReason;
      today: Date;
    };

/**
 * Determines whether the client should show the end-of-cycle review prompt.
 * The cycle remains ACTIVE until the user explicitly completes that review.
 */
export function getCycleReviewStatus(
  input: CycleReviewStatusInput,
): CycleReviewStatus {
  const today = startOfLocalDate(input.now, input.timezone);
  const cycleEndDate = startOfUtcDay(input.cycleEndDate);

  if (input.cycleStatus !== "ACTIVE") {
    return { reviewRequired: false, today };
  }

  if (
    today.getTime() === cycleEndDate.getTime() &&
    input.finalDayWorkoutsResolved === true
  ) {
    return {
      reviewRequired: true,
      reason: "FINAL_DAY_ACTION",
      today,
    };
  }

  if (today.getTime() > cycleEndDate.getTime()) {
    return {
      reviewRequired: true,
      reason: "PAST_END_DATE",
      today,
    };
  }

  return { reviewRequired: false, today };
}
