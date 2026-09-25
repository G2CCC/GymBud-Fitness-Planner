import { describe, expect, it } from "vitest";
import { cycleReviewResponseSchema, planResponseSchema } from "../../src/ai/schemas";
import { createDeterministicFakeAiClient } from "../../src/ai/fake-client";

describe("deterministic fake AI client", () => {
  it("returns a valid plan for the E2E plan prompt", async () => {
    const client = createDeterministicFakeAiClient();

    const result = await client.generateJson(
      {
        model: "test-model",
        promptVersion: "plan.v4",
        systemPrompt: "",
        userPrompt: JSON.stringify({
          cycle: {
            id: "cycle-e2e",
            startDate: "2026-09-15T00:00:00.000Z",
        endDate: "2026-09-21T00:00:00.000Z",
          },
          profile: {
            sessionDurationMinutes: 45,
          },
        }),
        metadata: { feature: "weekly-plan" },
      },
      planResponseSchema,
    );

    expect(result.workouts[0]).toMatchObject({
      scheduledDate: new Date("2026-09-15T00:00:00.000Z"),
      activityType: "STRENGTH",
    });
    expect(result.workouts[0]?.exercises[0]?.exerciseId).toBe(
      "free-exercise-db-Pushups",
    );
    expect(result.workouts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          activityType: "CARDIO",
          activityOptionId: "cardio-treadmill-running",
          exercises: [],
        }),
        expect.objectContaining({
          activityType: "SPORT",
          activityOptionId: "sport-basketball",
          exercises: [],
        }),
      ]),
    );
  });

  it("returns a valid review response for the E2E review prompt", async () => {
    const client = createDeterministicFakeAiClient();

    const result = await client.generateJson(
      {
        model: "test-model",
        promptVersion: "cycle-review.v2",
        systemPrompt: "",
        userPrompt: "{}",
        metadata: { feature: "weekly-review" },
      },
      cycleReviewResponseSchema,
    );

    expect(result.conclusions.status).toBe("CONTINUE");
    expect(result.processedSummary).toContain("actual training volume");
  });
});
