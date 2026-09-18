import type { AiRequest } from "../client";
import type {
  ExerciseExtractionInput,
} from "../schemas";

export const exerciseExtractionPromptVersion = "exercise-extraction.v1";
export const exerciseReplacementPromptVersion = "exercise-replacement.v1";

type ReplacementExercise = {
  id: string;
  name: string;
  equipment: string | null;
  targetMuscles: string[];
  movementPattern: string | null;
};

type ReplacementInput = {
  originalExercise: ReplacementExercise;
  candidates: ReplacementExercise[];
};

export function buildExerciseExtractionRequest(
  input: ExerciseExtractionInput,
  model: string,
): AiRequest {
  return {
    model,
    promptVersion: exerciseExtractionPromptVersion,
    systemPrompt: [
      "You classify one user-described strength exercise.",
      "Return JSON only with name, description, equipment, targetMuscles, and movementPattern.",
      "Use equipment NONE for bodyweight exercises.",
    ].join(" "),
    userPrompt: JSON.stringify({
      exerciseName: input.name,
      userDescription: input.description,
    }),
  };
}

export function buildExerciseReplacementRequest(
  input: ReplacementInput,
  model: string,
): AiRequest {
  return {
    model,
    promptVersion: exerciseReplacementPromptVersion,
    systemPrompt: [
      "You choose compatible exercise replacements for one unfinished strength workout.",
      "Return JSON only with a replacements array.",
      "Only choose exercise IDs from the provided candidate pool.",
      "Do not return the original exercise ID.",
      "Each replacement must include exerciseId, reason, sets, and may include restSeconds.",
      "The server will validate all ownership and exercise-pool rules.",
    ].join(" "),
    userPrompt: JSON.stringify({
      originalExercise: input.originalExercise,
      candidatePool: input.candidates,
    }),
  };
}
