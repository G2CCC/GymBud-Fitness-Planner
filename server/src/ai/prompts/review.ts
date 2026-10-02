import type {
  CycleTrainingVolume,
  CycleTrainingVolumeComparison,
} from "@fitness/shared/domain/reviews/cycle-volume";
import type { AiRequest } from "../client";
import type {NutritionSummary} from '@fitness/shared';

export const WEEKLY_REVIEW_PROMPT_VERSION = "weekly-review.v2";

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
  nutritionSummary?: NutritionSummary;
  previousNutritionSummary?: NutritionSummary;
};

export function buildWeeklyReviewRequest(
  input: CycleReviewPromptInput,
): AiRequest {
  const context: Record<string, unknown> = {
    cycleNumber: input.cycleNumber,
    trainingVolume: input.trainingVolume,
    nutritionSummary: input.nutritionSummary,
    previousNutritionSummary: input.previousNutritionSummary,
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
      'Keep processedSummary and conclusions about training. Return a separate nutritionReview with status, observations and suggestions; do not output calorie targets, macro replacements or meal plans.',
      'Interpret only the frozen nutrition summary. Fewer than 3 complete food days means INSUFFICIENT_DATA: describe recording coverage only, no weekly intake trends. At least 3 complete food days means AVAILABLE.',
      'Discuss net-target trends only when netComparableDays >= 3. If coverage is incomplete, explicitly state the missing coverage. Compare averages with their sample counts, never unequal-period totals.',
      'Targets and exercise calories are estimates. Do not praise low intake, encourage compensating for food through exercise, demand all four progress values reach 100%, or infer fat loss, muscle gain or body-weight changes without body measurements. Suggest practical recording improvements only. Never change targets.',
    ].join(" "),
    userPrompt: JSON.stringify(context),
    metadata: {
      feature: "weekly-review",
      cycleNumber: String(input.cycleNumber),
      cycleId: input.trainingVolume.cycleId,
    },
  };
}
