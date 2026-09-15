import { describe, expect, it } from "vitest";
import { buildPlanRequest } from "../../src/ai/prompts/plan";

const baseInput = {
  cycleId: "cycle-1",
  startDate: new Date("2026-10-01T00:00:00Z"),
  endDate: new Date("2026-10-28T00:00:00Z"),
  primaryGoal: "FAT_LOSS",
  secondaryOutcome: null,
  weeklyTrainingDays: 3,
  sessionDurationMinutes: 60,
  location: "GYM" as const,
  gender: null,
  age: null,
  heightCm: null,
  weightKg: null,
  exercises: [],
  model: "test-model",
};

describe("plan prompt", () => {
  it("includes supplied body context in metric units", () => {
    const request = buildPlanRequest({
      ...baseInput,
      gender: "MALE",
      age: 27,
      heightCm: 178,
      weightKg: 82,
    });

    const context = JSON.parse(request.userPrompt) as {
      profile: Record<string, unknown>;
    };

    expect(context.profile).toMatchObject({
      gender: "MALE",
      age: 27,
      heightCm: 178,
      weightKg: 82,
    });
  });

  it("omits missing body context instead of inventing values", () => {
    const request = buildPlanRequest({
      ...baseInput,
      gender: null,
      age: null,
      heightCm: null,
      weightKg: null,
    });

    const context = JSON.parse(request.userPrompt) as {
      profile: Record<string, unknown>;
    };

    expect(context.profile).not.toHaveProperty("gender");
    expect(context.profile).not.toHaveProperty("age");
    expect(context.profile).not.toHaveProperty("heightCm");
    expect(context.profile).not.toHaveProperty("weightKg");
  });
});
