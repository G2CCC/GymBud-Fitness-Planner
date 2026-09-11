import type { AiRequest } from "../client";

export const PLAN_PROMPT_VERSION = "plan.v1";

export type PlanPromptInput = {
  cycleId: string;
  startDate: Date;
  endDate: Date;
  primaryGoal: string;
  secondaryOutcome: string | null;
  weeklyTrainingDays: number;
  sessionDurationMinutes: number;
  location: "GYM" | "HOME";
  exercises: Array<{
    id: string;
    name: string;
    equipment: string | null;
    targetMuscles: string[];
    movementPattern: string | null;
    availableLocations: string[];
  }>;
  model: string;
};

export function buildPlanRequest(input: PlanPromptInput): AiRequest {
  return {
    model: input.model,
    promptVersion: PLAN_PROMPT_VERSION,
    systemPrompt: [
      "You generate a four-week fitness plan as JSON only.",
      "Use only exercise IDs from the supplied legal exercise pool.",
      "Every workout must use the supplied location.",
      "Strength workouts must contain at least one exercise and one planned set per exercise.",
      "Do not return RPE, subjective feedback, or unknown fields.",
      "Keep every scheduled date within the inclusive cycle dates.",
    ].join(" "),
    userPrompt: JSON.stringify({
      cycle: {
        id: input.cycleId,
        startDate: input.startDate.toISOString(),
        endDate: input.endDate.toISOString(),
      },
      profile: {
        primaryGoal: input.primaryGoal,
        secondaryOutcome: input.secondaryOutcome,
        weeklyTrainingDays: input.weeklyTrainingDays,
        sessionDurationMinutes: input.sessionDurationMinutes,
        location: input.location,
      },
      legalExercisePool: input.exercises,
      outputShape: {
        workouts: [
          {
            scheduledDate: "ISO date",
            activityType: "STRENGTH | CARDIO | SPORT",
            location: input.location,
            durationMinutes: input.sessionDurationMinutes,
            plannedDetails: "activity-specific object when needed",
            exercises: [
              {
                exerciseId: "legal exercise ID",
                sortOrder: 1,
                restSeconds: 90,
                sets: [{ setNumber: 1, targetReps: 10 }],
              },
            ],
          },
        ],
      },
    }),
    metadata: {
      feature: "four-week-plan",
      cycleId: input.cycleId,
    },
  };
}
