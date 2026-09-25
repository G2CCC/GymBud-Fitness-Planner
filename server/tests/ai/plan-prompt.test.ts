import { describe, expect, it } from "vitest";
import { buildPlanRequest } from "../../src/ai/prompts/plan";

const baseInput = {
  cycleId: "cycle-1",
  startDate: new Date("2026-10-01T00:00:00Z"),
  endDate: new Date("2026-10-28T00:00:00Z"),
  primaryGoal: "FAT_LOSS",
  weeklyTrainingDays: 3,
  sessionDurationMinutes: 60,
  gender: "MALE" as const,
  age: 27,
  heightCm: 178,
  weightKg: 82,
  exercises: [],
  activityOptions: [
    {
      id: "cardio-rowing-machine",
      activityType: "CARDIO" as const,
      name: "Rowing Machine",
    },
  ],
  model: "test-model",
};

describe("plan prompt", () => {
  it("includes required body context and omits location-specific context", () => {
    const request = buildPlanRequest(baseInput);

    const context = JSON.parse(request.userPrompt) as {
      profile: Record<string, unknown>;
    };

    expect(context.profile).toMatchObject({
      gender: "MALE",
      age: 27,
      heightCm: 178,
      weightKg: 82,
    });
    expect(context.profile).not.toHaveProperty("secondaryOutcome");
    expect(context.profile).not.toHaveProperty("location");
    expect(request.userPrompt).not.toContain("availableLocations");
    expect(request.systemPrompt).not.toContain("location");
    expect(request.userPrompt).toContain("legalActivityOptionPool");
    expect(request.systemPrompt).toMatch(/activityOptionId/i);
  });
});
