import { describe, expect, it } from "vitest";
import { buildWeeklyReviewRequest } from "../../src/ai/prompts/review";
import type { CycleTrainingVolume } from "@fitness/shared/domain/reviews/cycle-volume";

const volume: CycleTrainingVolume = {
  cycleId: "cycle-4",
  startDate: "2026-09-21T00:00:00.000Z",
  endDate: "2026-09-27T00:00:00.000Z",
  completedWorkoutCount: 3,
  strength: { completedWorkoutCount: 2, completedSetCount: 6, actualRepCount: 48, unweightedRepCount: 12, weightedVolume: { KG: 2160, LB: 0 } },
  cardio: { completedWorkoutCount: 1, actualDurationMinutes: 30, actualDistanceKm: 5 },
  sport: { completedWorkoutCount: 0, actualDurationMinutes: 0 },
};

describe("weekly review prompt", () => {
  it("sends current volume and optional previous-week comparison without user summary", () => {
    const request = buildWeeklyReviewRequest({
      model: "test-model",
      cycleNumber: 4,
      trainingVolume: volume,
      previousCycle: { cycleNumber: 3, trainingVolume: { ...volume, cycleId: "cycle-3" }, comparison: { completedWorkoutCountDelta: 0, strength: { completedSetCountDelta: 0, actualRepCountDelta: 0, unweightedRepCountDelta: 0, weightedVolumeDelta: { KG: 0, LB: 0 } }, cardio: { actualDurationMinutesDelta: 0, actualDistanceKmDelta: 0 }, sport: { actualDurationMinutesDelta: 0 } } },
    });
    expect(request.promptVersion).toBe("weekly-review.v1");
    expect(request.userPrompt).toContain("cycle-4");
    expect(request.userPrompt).toContain("cycle-3");
    expect(request.userPrompt).toContain("2160");
    expect(request.userPrompt).not.toContain("userSummary");
    expect(request.metadata?.feature).toBe("weekly-review");
  });
});
