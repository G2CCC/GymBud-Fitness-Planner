import { describe, expect, it } from "vitest";
import {
  aggregateCycleTrainingVolumes,
  buildCycleTrainingVolume,
  compareCycleTrainingVolume,
  type CycleTrainingVolumeInput,
} from "@fitness/shared/domain/reviews/cycle-volume";

const input: CycleTrainingVolumeInput = {
  cycleId: "cycle-current",
  startDate: new Date("2026-09-01T00:00:00Z"),
  endDate: new Date("2026-09-28T00:00:00Z"),
  workouts: [
    {
      id: "strength-1",
      activityType: "STRENGTH",
      status: "COMPLETED",
      actualExercises: [
        {
          sets: [
            { actualReps: 8, actualWeight: 60, weightUnit: "KG" },
            { actualReps: 7, actualWeight: 60, weightUnit: "KG" },
          ],
        },
      ],
    },
    {
        id: "bodyweight-1",
      activityType: "STRENGTH",
      status: "COMPLETED",
      actualExercises: [
        {
          sets: [{ actualReps: 12, actualWeight: 0, weightUnit: "KG" }],
        },
      ],
    },
    {
      id: "cardio-1",
      activityType: "CARDIO",
      status: "COMPLETED",
      actualDetails: { actualDurationMinutes: 30, distanceKm: 5 },
    },
    {
      id: "sport-1",
      activityType: "SPORT",
      status: "COMPLETED",
      actualDetails: { actualDurationMinutes: 60 },
    },
    {
      id: "cancelled-1",
      activityType: "CARDIO",
      status: "CANCELLED",
      actualDetails: { actualDurationMinutes: 99, distanceKm: 20 },
    },
  ],
};

describe("cycle training volume", () => {
  it("aggregates completed actual volume without mixing activity units", () => {
    expect(buildCycleTrainingVolume(input)).toEqual({
      cycleId: "cycle-current",
      startDate: "2026-09-01T00:00:00.000Z",
      endDate: "2026-09-28T00:00:00.000Z",
      completedWorkoutCount: 4,
      strength: {
        completedWorkoutCount: 2,
        completedSetCount: 3,
        actualRepCount: 27,
        unweightedRepCount: 12,
        weightedVolume: { KG: 900, LB: 0 },
      },
      cardio: {
        completedWorkoutCount: 1,
        actualDurationMinutes: 30,
        actualDistanceKm: 5,
      },
      sport: {
        completedWorkoutCount: 1,
        actualDurationMinutes: 60,
      },
    });
  });

  it("ignores actual details from incomplete workouts", () => {
    const result = buildCycleTrainingVolume({
      ...input,
      workouts: input.workouts.map((workout) => ({
        ...workout,
        status: "CANCELLED" as const,
      })),
    });

    expect(result.completedWorkoutCount).toBe(0);
    expect(result.cardio.actualDurationMinutes).toBe(0);
    expect(result.strength.actualRepCount).toBe(0);
  });

  it("creates a shallow metric delta for the previous cycle", () => {
    const current = buildCycleTrainingVolume(input);
    const previous = buildCycleTrainingVolume({
      ...input,
      cycleId: "cycle-previous",
      workouts: [input.workouts[0]!, input.workouts[2]!, input.workouts[3]!],
    });

    expect(compareCycleTrainingVolume(current, previous)).toEqual({
      completedWorkoutCountDelta: 1,
      strength: {
        completedSetCountDelta: 1,
        actualRepCountDelta: 12,
        unweightedRepCountDelta: 12,
        weightedVolumeDelta: { KG: 0, LB: 0 },
      },
      cardio: {
        actualDurationMinutesDelta: 0,
        actualDistanceKmDelta: 0,
      },
      sport: {
        actualDurationMinutesDelta: 0,
      },
    });
  });

  it("aggregates exactly four cycles without including an outside cycle", () => {
    const current = buildCycleTrainingVolume(input);
    const batch = aggregateCycleTrainingVolumes({
      startCycleNumber: 5,
      endCycleNumber: 8,
      cycles: [5, 6, 7, 8].map((cycleNumber) => ({
        cycleNumber,
        trainingVolume: { ...current, cycleId: `cycle-${cycleNumber}` },
      })),
    });

    expect(batch.cycles).toHaveLength(4);
    expect(batch.cycles.map((cycle) => cycle.cycleNumber)).toEqual([5, 6, 7, 8]);
    expect(batch.aggregate.completedWorkoutCount).toBe(16);
    expect(batch.aggregate.cardio.actualDistanceKm).toBe(20);
  });
});
