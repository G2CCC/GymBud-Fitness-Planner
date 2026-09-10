import { describe, expect, it } from "vitest";
import {
  profileInputSchema,
  setLogSchema,
} from "@fitness/shared/domain/validation";

describe("domain validation", () => {
  it("accepts the minimum profile scheduling inputs", () => {
    const result = profileInputSchema.parse({
      weeklyTrainingDays: 3,
      sessionDurationMinutes: 60,
      defaultLocation: "GYM",
      primaryGoal: "FAT_LOSS",
    });

    expect(result).toMatchObject({
      weeklyTrainingDays: 3,
      sessionDurationMinutes: 60,
      defaultLocation: "GYM",
    });
  });

  it("rejects an RPE field because MVP does not collect RPE", () => {
    expect(() =>
      setLogSchema.parse({ weight: 40, reps: 8, rpe: 7 }),
    ).toThrow();
  });

  it("rejects a home profile with an invalid training-day count", () => {
    expect(() =>
      profileInputSchema.parse({
        weeklyTrainingDays: 0,
        sessionDurationMinutes: 60,
        defaultLocation: "HOME",
        primaryGoal: "MUSCLE_GAIN",
      }),
    ).toThrow();
  });
});
