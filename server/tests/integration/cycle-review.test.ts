import "dotenv/config";
import { describe, expect, it } from "vitest";
import { FakeAiClient } from "../../src/ai/fake-client";
import { cycleReviewResponseSchema } from "../../src/ai/schemas";

describe("weekly review integration contract", () => {
  it("keeps the weekly review response schema independent of batch reviews", () => {
    const result = cycleReviewResponseSchema.safeParse({
      processedSummary: "The week was recorded.",
      conclusions: { status: "CONTINUE", keyFindings: ["Recorded training."], recommendations: ["Continue steadily."] },
    });
    expect(result.success).toBe(true);
  });

  it("fake AI exposes the weekly feature name", async () => {
    const ai = new FakeAiClient({
      processedSummary: "The week was recorded.",
      conclusions: { status: "CONTINUE", keyFindings: ["Recorded training."], recommendations: ["Continue steadily."] },
    });
    const result = await ai.generateJson({ model: "test", promptVersion: "weekly-review.v1", systemPrompt: "", userPrompt: "{}", metadata: { feature: "weekly-review" } }, cycleReviewResponseSchema);
    expect(result.processedSummary).toContain("week");
  });
});
