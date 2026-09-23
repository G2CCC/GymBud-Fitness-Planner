import { describe, expect, it } from "vitest";
import { buildSingleDayPlanRequest } from "../../src/ai/prompts/day-plan";

describe("single-day Strength plan prompt", () => {
  it("requests exactly one Strength workout for the selected date and focus", () => {
    const request = buildSingleDayPlanRequest({
      cycleId: "cycle-1",
      scheduledDate: new Date("2026-09-24T00:00:00Z"),
      focusAreas: ["UPPER_BODY", "CORE"],
      primaryGoal: "MUSCLE_GAIN",
      sessionDurationMinutes: 50,
      gender: "FEMALE",
      age: 29,
      heightCm: 168,
      weightKg: 64,
      exercises: [
        {
          id: "system-push-up",
          name: "Push-up",
          equipment: "NONE",
          targetMuscles: ["CHEST"],
          movementPattern: "PUSH",
        },
      ],
      model: "test-model",
    });

    const context = JSON.parse(request.userPrompt) as Record<string, any>;
    expect(request.promptVersion).toBe("day-plan.v1");
    expect(request.metadata).toEqual({
      feature: "single-day-strength-plan",
      cycleId: "cycle-1",
    });
    expect(context).toMatchObject({
      scheduledDate: "2026-09-24T00:00:00.000Z",
      focusAreas: ["UPPER_BODY", "CORE"],
      profile: {
        primaryGoal: "MUSCLE_GAIN",
        sessionDurationMinutes: 50,
      },
    });
    expect(request.systemPrompt).toMatch(/exactly one/i);
    expect(request.systemPrompt).toMatch(/strength/i);
    expect(request.systemPrompt).toMatch(/legal exercise/i);
  });
});
