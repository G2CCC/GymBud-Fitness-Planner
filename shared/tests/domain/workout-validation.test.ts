import { describe, expect, it } from "vitest";
import {
  cardioWorkoutLogInputSchema,
  extraWorkoutInputSchema,
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

  it("accepts activity-specific cardio, sport, and extra-workout data", () => {
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
      extraWorkoutInputSchema.parse({
        activityType: "CARDIO",
        scheduledDate: "2026-11-06T00:00:00Z",
        location: "HOME",
        durationMinutes: 30,
      }),
    ).toMatchObject({ activityType: "CARDIO", location: "HOME" });
  });
});
