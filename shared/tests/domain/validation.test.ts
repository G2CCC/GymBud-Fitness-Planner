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

  it("accepts an IANA timezone for cycle creation", () => {
    const result = cycleDraftInputSchema.parse({
      weeklyTrainingDays: 3,
      sessionDurationMinutes: 60,
      defaultLocation: "GYM",
      primaryGoal: "FAT_LOSS",
      timezone: "America/Los_Angeles",
    });

    expect(result.timezone).toBe("America/Los_Angeles");
  });

  it("rejects an invalid timezone instead of silently using server time", () => {
    expect(() =>
      cycleDraftInputSchema.parse({
        weeklyTrainingDays: 3,
        sessionDurationMinutes: 60,
        defaultLocation: "GYM",
        primaryGoal: "FAT_LOSS",
        timezone: "Not/A_Timezone",
      }),
    ).toThrow();
  });
});
