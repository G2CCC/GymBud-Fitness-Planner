import { describe, expect, it } from "vitest";
import { getCycleReviewStatus } from "@fitness/shared/domain/cycles/review-status";

describe("cycle review timing", () => {
  const cycleEndDate = new Date("2026-11-03T00:00:00Z");

  it("derives the current calendar date from the user's system timezone", () => {
    const result = getCycleReviewStatus({
      cycleStatus: "ACTIVE",
      cycleEndDate,
      now: new Date("2026-10-07T12:00:00Z"),
      timezone: "Pacific/Auckland",
      plannedWorkoutCount: 0,
    });

    expect(result).toEqual({
      reviewRequired: false,
      reviewAvailable: false,
      today: new Date("2026-10-08T00:00:00Z"),
      reviewAvailableOn: cycleEndDate,
      daysUntilReview: 26,
      plannedWorkoutCount: 0,
      blockedReason: "BEFORE_REVIEW_DATE",
    });
  });

  it("does not prompt on the cycle's final day until its workouts are resolved", () => {
    const result = getCycleReviewStatus({
      cycleStatus: "ACTIVE",
      cycleEndDate,
      now: new Date("2026-11-03T23:00:00Z"),
      timezone: "UTC",
      plannedWorkoutCount: 1,
    });

    expect(result).toEqual({
      reviewRequired: false,
      reviewAvailable: false,
      today: cycleEndDate,
      reviewAvailableOn: cycleEndDate,
      daysUntilReview: 0,
      plannedWorkoutCount: 1,
      blockedReason: "PLANNED_WORKOUTS_REMAINING",
    });
  });

  it("prompts immediately after final-day workouts are resolved", () => {
    const result = getCycleReviewStatus({
      cycleStatus: "ACTIVE",
      cycleEndDate,
      now: new Date("2026-11-03T23:00:00Z"),
      timezone: "UTC",
      plannedWorkoutCount: 0,
    });

    expect(result).toEqual({
      reviewRequired: true,
      reviewAvailable: true,
      today: cycleEndDate,
      reviewAvailableOn: cycleEndDate,
      daysUntilReview: 0,
      plannedWorkoutCount: 0,
      blockedReason: null,
    });
  });

  it("keeps review blocked after the end date while planned work remains", () => {
    const result = getCycleReviewStatus({
      cycleStatus: "ACTIVE",
      cycleEndDate,
      now: new Date("2026-11-04T12:00:00Z"),
      timezone: "UTC",
      plannedWorkoutCount: 1,
    });

    expect(result).toEqual({
      reviewRequired: false,
      reviewAvailable: false,
      today: new Date("2026-11-04T00:00:00Z"),
      reviewAvailableOn: cycleEndDate,
      daysUntilReview: 0,
      plannedWorkoutCount: 1,
      blockedReason: "PLANNED_WORKOUTS_REMAINING",
    });
  });

  it("prompts on a later login when all workouts are resolved", () => {
    const result = getCycleReviewStatus({
      cycleStatus: "ACTIVE",
      cycleEndDate,
      now: new Date("2026-11-04T12:00:00Z"),
      timezone: "UTC",
      plannedWorkoutCount: 0,
    });

    expect(result).toEqual({
      reviewRequired: true,
      reviewAvailable: true,
      today: new Date("2026-11-04T00:00:00Z"),
      reviewAvailableOn: cycleEndDate,
      daysUntilReview: 0,
      plannedWorkoutCount: 0,
      blockedReason: null,
    });
  });

  it("never prompts for a draft or closed cycle", () => {
    expect(
      getCycleReviewStatus({
        cycleStatus: "DRAFT",
        cycleEndDate,
        now: new Date("2026-11-04T12:00:00Z"),
        timezone: "UTC",
        plannedWorkoutCount: 0,
      }),
    ).toEqual({
      reviewRequired: false,
      reviewAvailable: false,
      today: new Date("2026-11-04T00:00:00Z"),
      reviewAvailableOn: cycleEndDate,
      daysUntilReview: 0,
      plannedWorkoutCount: 0,
      blockedReason: "CYCLE_NOT_ACTIVE",
    });

    expect(
      getCycleReviewStatus({
        cycleStatus: "CLOSED",
        cycleEndDate,
        now: new Date("2026-11-04T12:00:00Z"),
        timezone: "UTC",
        plannedWorkoutCount: 0,
      }),
    ).toEqual({
      reviewRequired: false,
      reviewAvailable: false,
      today: new Date("2026-11-04T00:00:00Z"),
      reviewAvailableOn: cycleEndDate,
      daysUntilReview: 0,
      plannedWorkoutCount: 0,
      blockedReason: "CYCLE_NOT_ACTIVE",
    });
  });
});
