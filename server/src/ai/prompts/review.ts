import type {
  CycleTrainingVolume,
  CycleTrainingVolumeComparison,
} from "@fitness/shared/domain/reviews/cycle-volume";
import type { AiRequest } from "../client";

export const CYCLE_REVIEW_PROMPT_VERSION = "cycle-review.v2";
export const FOUR_CYCLE_REVIEW_PROMPT_VERSION = "four-cycle-review.v1";

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
  optionalUserSummary?: string;
};

export type CycleBatchReviewPromptInput = {
  model: string;
  startCycleNumber: number;
  endCycleNumber: number;
  cycleVolumes: Array<{
    cycleNumber: number;
    trainingVolume: CycleTrainingVolume;
  }>;
  optionalUserSummary?: string;
};

export function buildCycleReviewRequest(
  input: CycleReviewPromptInput,
): AiRequest {
  const context: Record<string, unknown> = {
    cycleNumber: input.cycleNumber,
    trainingVolume: input.trainingVolume,
  };

  if (input.previousCycle) {
    context.previousCycle = input.previousCycle;
  }

  const optionalUserSummary = input.optionalUserSummary?.trim();
  if (optionalUserSummary) {
    context.userSummary = optionalUserSummary;
  }

  return {
    model: input.model,
    promptVersion: CYCLE_REVIEW_PROMPT_VERSION,
    systemPrompt: [
      "You review one completed fitness cycle as JSON only.",
      "Use actual training volume as the source of truth.",
      "Do not infer whether a workout came from AI or the user.",
      "Do not invent planned workouts, measurements, or subjective feedback.",
      "The previous cycle is optional shallow comparison context only.",
      "If no completed workouts exist, the conclusion status must be RESET_REQUIRED.",
      "Return processedSummary and concise keyFindings and recommendations.",
    ].join(" "),
    userPrompt: JSON.stringify(context),
    metadata: {
      feature: "cycle-review",
      cycleNumber: String(input.cycleNumber),
      cycleId: input.trainingVolume.cycleId,
    },
  };
}

export function buildCycleBatchReviewRequest(
  input: CycleBatchReviewPromptInput,
): AiRequest {
  const context: Record<string, unknown> = {
    startCycleNumber: input.startCycleNumber,
    endCycleNumber: input.endCycleNumber,
    cycleVolumes: input.cycleVolumes,
  };

  const optionalUserSummary = input.optionalUserSummary?.trim();
  if (optionalUserSummary) {
    context.userSummary = optionalUserSummary;
  }

  return {
    model: input.model,
    promptVersion: FOUR_CYCLE_REVIEW_PROMPT_VERSION,
    systemPrompt: [
      "You review exactly one fixed four-cycle fitness batch as JSON only.",
      "Use only the four supplied cycles and their actual training volumes.",
      "Never accumulate or infer volume from cycles outside this batch.",
      "Do not infer workout source, planned workouts, or unsupported subjective feedback.",
      "Return processedSummary and concise keyFindings and recommendations.",
    ].join(" "),
    userPrompt: JSON.stringify(context),
    metadata: {
      feature: "four-cycle-review",
      startCycleNumber: String(input.startCycleNumber),
      endCycleNumber: String(input.endCycleNumber),
    },
  };
}
