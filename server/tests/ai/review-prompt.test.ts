import { describe, expect, it } from "vitest";
import {
  buildCycleReviewRequest,
} from "../../src/ai/prompts/review";
import type { ObjectiveCycleSummary } from "@fitness/shared/domain/reviews/objective-summary";

const objectiveSummary: ObjectiveCycleSummary = {
  cycleId: "cycle-1",
  startDate: "2026-11-01T00:00:00.000Z",
  endDate: "2026-11-28T00:00:00.000Z",
  total: {
    total: 1,
    completed: 1,
    cancelled: 0,
    planned: 0,
    completionRate: 1,
  },
  cancellations: { total: 0, user: 0, automatic: 0 },
  rescheduleCount: 0,
  strength: { workouts: [] },
  cardio: {
    workouts: [],
    plannedDurationMinutes: 0,
    actualDurationMinutes: 0,
    plannedDistanceKm: 0,
    actualDistanceKm: 0,
  },
  sport: { workouts: [], plannedDurationMinutes: 0, actualDurationMinutes: 0 },
  zeroCompletedCycle: false,
  nextCycleEligibility: "ELIGIBLE",
};

describe("cycle review prompt", () => {
  it("omits the optional user summary when it is empty", () => {
    const request = buildCycleReviewRequest({
      model: "test-model",
      cycleId: "cycle-1",
      objectiveSummary,
      optionalUserSummary: "  ",
    });

    expect(request.userPrompt).not.toContain("userSummary");
  });

  it("includes a supplied summary only in the transient AI request", () => {
    const request = buildCycleReviewRequest({
      model: "test-model",
      cycleId: "cycle-1",
      objectiveSummary,
      optionalUserSummary: "I had less time this month.",
    });

    expect(request.userPrompt).toContain("I had less time this month.");
    expect(request.metadata).toEqual({
      feature: "cycle-review",
      cycleId: "cycle-1",
    });
  });
});
