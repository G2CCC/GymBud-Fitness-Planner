import { describe, expect, it } from "vitest";
import {
  buildObjectiveCycleSummary,
  type ObjectiveCycleSummaryInput,
} from "@fitness/shared/domain/reviews/objective-summary";

const baseInput: ObjectiveCycleSummaryInput = {
  cycleId: "cycle-1",
  startDate: new Date("2026-11-01T00:00:00Z"),
  endDate: new Date("2026-11-28T00:00:00Z"),
  workouts: [
    {
      id: "original-strength",
      activityType: "STRENGTH",
      status: "COMPLETED",
      durationMinutes: 60,
      rescheduleCount: 2,
      plannedExercises: [
        {
          exerciseId: "bench-press",
          sets: [
            {
              setNumber: 1,
              targetReps: 8,
              plannedWeight: 60,
              weightUnit: "KG",
            },
            {
              setNumber: 2,
              targetReps: 8,
              plannedWeight: 60,
              weightUnit: "KG",
            },
          ],
        },
      ],
      actualExercises: [
        {
          exerciseId: "bench-press",
          sets: [
            {
              setNumber: 1,
              actualReps: 8,
              actualWeight: 60,
              weightUnit: "KG",
            },
            {
              setNumber: 2,
              actualReps: 7,
              actualWeight: 60,
              weightUnit: "KG",
            },
          ],
        },
      ],
    },
    {
      id: "original-cardio",
      activityType: "CARDIO",
      status: "PLANNED",
      durationMinutes: 30,
      rescheduleCount: 0,
      plannedDetails: { distanceKm: 5 },
      actualDetails: null,
    },
    {
      id: "extra-cardio",
      activityType: "CARDIO",
      status: "COMPLETED",
      durationMinutes: 20,
      rescheduleCount: 1,
      plannedDetails: { distanceKm: 3 },
      actualDetails: { actualDurationMinutes: 25, distanceKm: 3.5 },
    },
  ],
};

describe("objective cycle summary", () => {
  it("summarizes all planned workouts without source classifications", () => {
    const result = buildObjectiveCycleSummary(baseInput);

    expect(result.total).toMatchObject({
      total: 2,
      completed: 2,
      completionRate: 1,
    });
    expect(result.rescheduleCount).toBe(3);
    expect(result.nextCycleEligibility).toBe("ELIGIBLE");
  });

  it("keeps planned and actual strength sets side by side", () => {
    const result = buildObjectiveCycleSummary(baseInput);

    expect(result.strength.workouts).toEqual([
      {
        workoutId: "original-strength",
        status: "COMPLETED",
        exercises: [
          {
            exerciseId: "bench-press",
            plannedSets: [
              {
                setNumber: 1,
                targetReps: 8,
                plannedWeight: 60,
                weightUnit: "KG",
              },
              {
                setNumber: 2,
                targetReps: 8,
                plannedWeight: 60,
                weightUnit: "KG",
              },
            ],
            actualSets: [
              {
                setNumber: 1,
                actualReps: 8,
                actualWeight: 60,
                weightUnit: "KG",
              },
              {
                setNumber: 2,
                actualReps: 7,
                actualWeight: 60,
                weightUnit: "KG",
              },
            ],
          },
        ],
      },
    ]);
  });

  it("summarizes cardio duration and distance without inventing missing logs", () => {
    const result = buildObjectiveCycleSummary(baseInput);

    expect(result.cardio).toMatchObject({
      plannedDurationMinutes: 20,
      actualDurationMinutes: 25,
      plannedDistanceKm: 3,
      actualDistanceKm: 3.5,
    });
  });

  it("marks a cycle with no completed workout as requiring reset", () => {
    const result = buildObjectiveCycleSummary({
      ...baseInput,
      workouts: baseInput.workouts.map((workout) => ({
        ...workout,
        status: "PLANNED",
      })),
    });

    expect(result.total.completed).toBe(0);
    expect(result.zeroCompletedCycle).toBe(true);
    expect(result.nextCycleEligibility).toBe("RESET_REQUIRED");
  });
});
