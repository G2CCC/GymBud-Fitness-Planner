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
    });

    expect(result).toEqual({
      reviewRequired: false,
      today: new Date("2026-10-08T00:00:00Z"),
    });
  });

  it("does not prompt on the cycle's final day until its workouts are resolved", () => {
    const result = getCycleReviewStatus({
      cycleStatus: "ACTIVE",
      cycleEndDate,
      now: new Date("2026-11-03T23:00:00Z"),
      timezone: "UTC",
      finalDayWorkoutsResolved: false,
    });

    expect(result).toEqual({
      reviewRequired: false,
      today: cycleEndDate,
    });
  });

  it("prompts immediately after final-day workouts are resolved", () => {
    const result = getCycleReviewStatus({
      cycleStatus: "ACTIVE",
      cycleEndDate,
      now: new Date("2026-11-03T23:00:00Z"),
      timezone: "UTC",
      finalDayWorkoutsResolved: true,
    });

    expect(result).toEqual({
      reviewRequired: true,
      reason: "FINAL_DAY_ACTION",
      today: cycleEndDate,
    });
  });

  it("prompts on a later login while leaving the cycle active", () => {
    const result = getCycleReviewStatus({
      cycleStatus: "ACTIVE",
      cycleEndDate,
      now: new Date("2026-11-04T12:00:00Z"),
      timezone: "UTC",
    });

    expect(result).toEqual({
      reviewRequired: true,
      reason: "PAST_END_DATE",
      today: new Date("2026-11-04T00:00:00Z"),
    });
  });

  it("never prompts for a draft or closed cycle", () => {
    expect(
      getCycleReviewStatus({
        cycleStatus: "DRAFT",
        cycleEndDate,
        now: new Date("2026-11-04T12:00:00Z"),
        timezone: "UTC",
      }),
    ).toEqual({
      reviewRequired: false,
      today: new Date("2026-11-04T00:00:00Z"),
    });

    expect(
      getCycleReviewStatus({
        cycleStatus: "CLOSED",
        cycleEndDate,
        now: new Date("2026-11-04T12:00:00Z"),
        timezone: "UTC",
      }),
    ).toEqual({
      reviewRequired: false,
      today: new Date("2026-11-04T00:00:00Z"),
    });
  });
});
