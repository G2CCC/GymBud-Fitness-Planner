import { describe, expect, it } from "vitest";
import { profileInputSchema } from "@fitness/shared/domain/validation";

const requiredProfile = {
  primaryGoal: "FAT_LOSS",
  weeklyTrainingDays: 3,
  sessionDurationMinutes: 60,
  defaultLocation: "GYM" as const,
};

describe("profile validation", () => {
  it("accepts optional demographic planning context", () => {
    expect(
      profileInputSchema.parse({
        ...requiredProfile,
        gender: "MALE",
        age: 27,
        heightCm: 178,
        weightKg: 82,
      }),
    ).toMatchObject({
      gender: "MALE",
      age: 27,
      heightCm: 178,
      weightKg: 82,
    });
  });

  it("allows missing demographic context", () => {
    expect(profileInputSchema.parse(requiredProfile)).not.toHaveProperty("age");
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
