import type {
  CycleTrainingVolume,
  CycleTrainingVolumeComparison,
} from "@fitness/shared/domain/reviews/cycle-volume";
import type { AiRequest } from "../client";

export const WEEKLY_REVIEW_PROMPT_VERSION = "weekly-review.v1";

export type PreviousCycleReviewContext = {
  cycleNumber: number;
  trainingVolume: CycleTrainingVolume;
  comparison: CycleTrainingVolumeComparison;
};

export type CycleReviewPromptInput = {
  model: string;
  cycleNumber: number;
  trainingVolume: CycleTrainingVolume;
  previousCycle?: PreviousCycleReviewContext;
};

export function buildWeeklyReviewRequest(
  input: CycleReviewPromptInput,
): AiRequest {
  const context: Record<string, unknown> = {
    cycleNumber: input.cycleNumber,
    trainingVolume: input.trainingVolume,
  };

  if (input.previousCycle) {
    context.previousCycle = input.previousCycle;
  }

  return {
    model: input.model,
    promptVersion: WEEKLY_REVIEW_PROMPT_VERSION,
    systemPrompt: [
      "You review one completed weekly fitness cycle as JSON only.",
      "Use actual training volume as the source of truth.",
      "Do not infer whether a workout came from AI or the user.",
      "Do not invent planned workouts, measurements, or subjective feedback.",
      "The previous cycle is optional shallow comparison context only.",
      "If no completed workouts exist, the conclusion status must be RESET_REQUIRED.",
      "Return processedSummary and concise keyFindings and recommendations.",
    ].join(" "),
    userPrompt: JSON.stringify(context),
    metadata: {
      feature: "weekly-review",
      cycleNumber: String(input.cycleNumber),
      cycleId: input.trainingVolume.cycleId,
    },
  };
}
