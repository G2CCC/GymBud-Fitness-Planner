import type { ObjectiveCycleSummary } from "@fitness/shared/domain/reviews/objective-summary";
import type { AiRequest } from "../client";

export const CYCLE_REVIEW_PROMPT_VERSION = "cycle-review.v1";

export type CycleReviewPromptInput = {
  model: string;
  cycleId: string;
  objectiveSummary: ObjectiveCycleSummary;
  optionalUserSummary?: string;
};

export function buildCycleReviewRequest(
  input: CycleReviewPromptInput,
): AiRequest {
  const context: Record<string, unknown> = {
    cycleId: input.cycleId,
    objectiveSummary: input.objectiveSummary,
  };

  const optionalUserSummary = input.optionalUserSummary?.trim();
  if (optionalUserSummary) {
    context.userSummary = optionalUserSummary;
  }

  return {
    model: input.model,
    promptVersion: CYCLE_REVIEW_PROMPT_VERSION,
    systemPrompt: [
      "You review a completed four-week fitness cycle as JSON only.",
      "Use objective workout data as the source of truth.",
      "The optional user summary is context, not a replacement for saved records.",
      "Do not invent workouts, measurements, or subjective feedback that are not supplied.",
      "If zero workouts were completed, the conclusion status must be RESET_REQUIRED.",
      "Return processedSummary and concise keyFindings and recommendations.",
    ].join(" "),
    userPrompt: JSON.stringify(context),
    metadata: {
      feature: "cycle-review",
      cycleId: input.cycleId,
    },
  };
}
