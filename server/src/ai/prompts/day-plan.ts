import type { Gender } from "@fitness/shared";
import type { AiRequest } from "../client";

export const SINGLE_DAY_PLAN_PROMPT_VERSION = "day-plan.v1";

export type SingleDayPlanPromptInput = {
  cycleId: string;
  scheduledDate: Date;
  focusAreas: string[];
  primaryGoal: string;
  sessionDurationMinutes: number;
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  exercises: Array<{
    id: string;
    name: string;
    equipment: string | null;
    targetMuscles: string[];
    movementPattern: string | null;
  }>;
  model: string;
};

export function buildSingleDayPlanRequest(
  input: SingleDayPlanPromptInput,
): AiRequest {
  return {
    model: input.model,
    promptVersion: SINGLE_DAY_PLAN_PROMPT_VERSION,
    systemPrompt: [
      "Generate exactly one Strength workout as JSON only for the selected date.",
      "Use only exercise IDs from the supplied legal exercise pool.",
      "The workout must include at least one exercise and one planned set per exercise.",
      "Do not return Cardio, Sport, RPE, subjective feedback, or unknown fields.",
      "Respect the requested focus areas and session duration without inventing exercises.",
    ].join(" "),
    userPrompt: JSON.stringify({
      cycleId: input.cycleId,
      scheduledDate: input.scheduledDate.toISOString(),
      focusAreas: input.focusAreas,
      profile: {
        primaryGoal: input.primaryGoal,
        sessionDurationMinutes: input.sessionDurationMinutes,
        gender: input.gender,
        age: input.age,
        heightCm: input.heightCm,
        weightKg: input.weightKg,
      },
      legalExercisePool: input.exercises,
      outputShape: {
        workout: {
          scheduledDate: input.scheduledDate.toISOString(),
          activityType: "STRENGTH",
          durationMinutes: input.sessionDurationMinutes,
          exercises: [
            {
              exerciseId: "legal exercise ID",
              sortOrder: 1,
              restSeconds: 90,
              sets: [{ setNumber: 1, targetReps: 10 }],
            },
          ],
        },
      },
    }),
    metadata: {
      feature: "single-day-strength-plan",
      cycleId: input.cycleId,
    },
  };
}
