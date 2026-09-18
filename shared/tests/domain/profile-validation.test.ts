import { describe, expect, it } from "vitest";
import { profileInputSchema } from "@fitness/shared/domain/validation";

const requiredProfile = {
  primaryGoal: "FAT_LOSS",
  weeklyTrainingDays: 3,
  sessionDurationMinutes: 60,
  gender: "MALE" as const,
  age: 27,
  heightCm: 178,
  weightKg: 82,
};

describe("profile validation", () => {
  it("accepts the required demographic planning context", () => {
    expect(profileInputSchema.parse(requiredProfile)).toMatchObject({
      gender: "MALE",
      age: 27,
      heightCm: 178,
      weightKg: 82,
    });
  });

  it.each(["gender", "age", "heightCm", "weightKg"])(
    "requires %s",
    (field) => {
      const input = { ...requiredProfile };
      delete input[field as keyof typeof input];
      expect(() => profileInputSchema.parse(input)).toThrow();
    },
  );

  it("removes secondary outcome and default location from the profile contract", () => {
    expect(() =>
      profileInputSchema.parse({
        ...requiredProfile,
        secondaryOutcome: "MUSCLE_PRESERVATION",
        defaultLocation: "GYM",
      }),
    ).toThrow();
  });

  it.each([
    ["age", 12],
    ["age", 101],
    ["heightCm", 49],
    ["heightCm", 251],
    ["weightKg", 19],
    ["weightKg", 351],
  ])("rejects an out-of-range %s value", (field, value) => {
    expect(() =>
      profileInputSchema.parse({ ...requiredProfile, [field]: value }),
    ).toThrow();
  });
});
