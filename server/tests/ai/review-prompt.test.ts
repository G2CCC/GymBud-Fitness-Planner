import { describe, expect, it } from "vitest";
import {
  buildCycleBatchReviewRequest,
  buildCycleReviewRequest,
} from "../../src/ai/prompts/review";
import type { CycleTrainingVolume } from "@fitness/shared/domain/reviews/cycle-volume";

const volume: CycleTrainingVolume = {
  cycleId: "cycle-4",
  startDate: "2026-11-01T00:00:00.000Z",
  endDate: "2026-11-28T00:00:00.000Z",
  completedWorkoutCount: 3,
  strength: {
    completedWorkoutCount: 2,
    completedSetCount: 6,
    actualRepCount: 48,
    unweightedRepCount: 12,
    weightedVolume: { KG: 2160, LB: 0 },
  },
  cardio: {
    completedWorkoutCount: 1,
    actualDurationMinutes: 30,
    actualDistanceKm: 5,
  },
  sport: {
    completedWorkoutCount: 0,
    actualDurationMinutes: 0,
  },
};

describe("cycle review prompts", () => {
  it("sends actual training volume instead of source or planned workout details", () => {
    const request = buildCycleReviewRequest({
      model: "test-model",
      cycleNumber: 4,
      trainingVolume: volume,
      optionalUserSummary: "I had less time this month.",
    });

    expect(request.userPrompt).toContain("trainingVolume");
    expect(request.userPrompt).toContain("2160");
    expect(request.userPrompt).toContain("I had less time this month.");
    expect(request.userPrompt).not.toContain("objectiveSummary");
    expect(request.userPrompt).not.toContain("plannedExercises");
    expect(request.userPrompt).not.toContain("source");
  });

  it("omits an empty user summary and can include only a previous-cycle comparison", () => {
    const request = buildCycleReviewRequest({
      model: "test-model",
      cycleNumber: 4,
      trainingVolume: volume,
      previousCycle: {
        cycleNumber: 3,
        trainingVolume: {
          ...volume,
          cycleId: "cycle-3",
          completedWorkoutCount: 2,
        },
      },
      optionalUserSummary: "  ",
    });

    expect(request.userPrompt).toContain("previousCycle");
    expect(request.userPrompt).toContain("cycle-3");
    expect(request.userPrompt).not.toContain("userSummary");
  });

  it("sends exactly the fixed four-cycle window for a batch review", () => {
    const request = buildCycleBatchReviewRequest({
      model: "test-model",
      startCycleNumber: 5,
      endCycleNumber: 8,
      cycleVolumes: [5, 6, 7, 8].map((cycleNumber) => ({
        cycleNumber,
        trainingVolume: { ...volume, cycleId: `cycle-${cycleNumber}` },
      })),
    });

    expect(request.userPrompt).toContain("cycle-5");
    expect(request.userPrompt).toContain("cycle-8");
    expect(request.userPrompt).not.toContain("cycle-4");
    expect(request.userPrompt).not.toContain("cycle-9");
    expect(request.metadata).toMatchObject({
      feature: "four-cycle-review",
      startCycleNumber: "5",
      endCycleNumber: "8",
    });
  });
});
