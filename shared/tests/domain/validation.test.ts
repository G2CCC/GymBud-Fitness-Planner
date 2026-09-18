import { describe, expect, it } from "vitest";
import { cycleStatuses } from "@fitness/shared/domain/enums";
import {
  cycleDraftInputSchema,
  profileInputSchema,
  setLogSchema,
} from "@fitness/shared/domain/validation";

describe("domain validation", () => {
  it("exposes only the three supported cycle lifecycle states", () => {
    expect(cycleStatuses).toEqual(["DRAFT", "ACTIVE", "CLOSED"]);
  });

  it("accepts a complete profile for cycle creation", () => {
    const result = profileInputSchema.parse({
      weeklyTrainingDays: 3,
      sessionDurationMinutes: 60,
      primaryGoal: "FAT_LOSS",
      gender: "MALE",
      age: 27,
      heightCm: 178,
      weightKg: 82,
    });

    expect(result).toMatchObject({
      weeklyTrainingDays: 3,
      sessionDurationMinutes: 60,
      gender: "MALE",
    });
  });

  it("rejects an RPE field because MVP does not collect RPE", () => {
    expect(() =>
      setLogSchema.parse({ weight: 40, reps: 8, weightUnit: "KG", rpe: 7 }),
    ).toThrow();
  });

  it("requires actual weight and weight unit for every set log", () => {
    expect(() => setLogSchema.parse({ reps: 8, weightUnit: "KG" })).toThrow();
    expect(() => setLogSchema.parse({ reps: 8, weight: 40 })).toThrow();
    expect(
      setLogSchema.parse({ reps: 8, weight: 0, weightUnit: "KG" }),
    ).toMatchObject({ weight: 0, weightUnit: "KG" });
  });

  it("rejects an invalid training-day count", () => {
    expect(() =>
      profileInputSchema.parse({
        weeklyTrainingDays: 0,
        sessionDurationMinutes: 60,
        primaryGoal: "MUSCLE_GAIN",
        gender: "MALE",
        age: 27,
        heightCm: 178,
        weightKg: 82,
      }),
    ).toThrow();
  });

  it("accepts an IANA timezone for cycle creation", () => {
    const result = cycleDraftInputSchema.parse({
      weeklyTrainingDays: 3,
      sessionDurationMinutes: 60,
      primaryGoal: "FAT_LOSS",
      gender: "MALE",
      age: 27,
      heightCm: 178,
      weightKg: 82,
      timezone: "America/Los_Angeles",
    });

    expect(result.timezone).toBe("America/Los_Angeles");
  });

  it("rejects an invalid timezone instead of silently using server time", () => {
    expect(() =>
      cycleDraftInputSchema.parse({
        weeklyTrainingDays: 3,
        sessionDurationMinutes: 60,
        primaryGoal: "FAT_LOSS",
        gender: "MALE",
        age: 27,
        heightCm: 178,
        weightKg: 82,
        timezone: "Not/A_Timezone",
      }),
    ).toThrow();
  });
});
