import { describe, expect, it } from "vitest";
import {
  cardioWorkoutLogInputSchema,
  createWorkoutInputSchema,
  sportWorkoutLogInputSchema,
  strengthWorkoutLogInputSchema,
} from "@fitness/shared/domain/workouts/validation";

describe("workout log validation", () => {
  it("accepts per-set strength data", () => {
    expect(
      strengthWorkoutLogInputSchema.parse({
        exercises: [
          {
            exerciseId: "system-push-up",
            sortOrder: 1,
            sets: [{ setNumber: 1, reps: 10, weight: 0, weightUnit: "KG" }],
          },
        ],
      }),
    ).toMatchObject({ exercises: [{ sets: [{ reps: 10 }] }] });
  });

  it("rejects RPE from strength, cardio, and sport logs", () => {
    expect(() =>
      strengthWorkoutLogInputSchema.parse({
        exercises: [
          {
            exerciseId: "system-push-up",
            sortOrder: 1,
            sets: [{ setNumber: 1, reps: 10, rpe: 7 }],
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      cardioWorkoutLogInputSchema.parse({
        actualDurationMinutes: 30,
        rpe: 7,
      }),
    ).toThrow();

    expect(() =>
      sportWorkoutLogInputSchema.parse({
        actualDurationMinutes: 60,
        rpe: 7,
      }),
    ).toThrow();
  });

  it("accepts activity-specific cardio, sport, and planned workout data", () => {
    expect(
      cardioWorkoutLogInputSchema.parse({
        actualDurationMinutes: 30,
        distanceKm: 5,
        paceSecondsPerKm: 360,
      }),
    ).toMatchObject({ distanceKm: 5 });

    expect(
      sportWorkoutLogInputSchema.parse({
        actualDurationMinutes: 60,
        sportName: "Tennis",
        intensity: "MODERATE",
        notes: "Footwork drills",
      }),
    ).toMatchObject({ sportName: "Tennis" });

    expect(
      createWorkoutInputSchema.parse({
        activityType: "CARDIO",
        scheduledDate: "2026-11-06T00:00:00Z",
        durationMinutes: 30,
      }),
    ).toMatchObject({ activityType: "CARDIO" });
  });

  it("accepts nested strength plan data and rejects it for cardio", () => {
    expect(
      createWorkoutInputSchema.parse({
        activityType: "STRENGTH",
        scheduledDate: "2026-11-06T00:00:00Z",
        durationMinutes: 45,
        plannedExercises: [
          {
            exerciseId: "system-barbell-bench-press",
            sortOrder: 1,
            restSeconds: 120,
            sets: [
              { setNumber: 1, targetReps: 8, plannedWeight: 60, weightUnit: "KG" },
            ],
          },
        ],
      }),
    ).toMatchObject({ plannedExercises: [{ sortOrder: 1 }] });

    expect(() =>
      createWorkoutInputSchema.parse({
        activityType: "CARDIO",
        scheduledDate: "2026-11-06T00:00:00Z",
        durationMinutes: 30,
        plannedExercises: [
          {
            exerciseId: "system-push-up",
            sortOrder: 1,
            sets: [{ setNumber: 1, targetReps: 10 }],
          },
        ],
      }),
    ).toThrow();
  });
});
