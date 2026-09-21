import type { AiRequest } from "../client";
import type {
  CycleTrainingVolume,
} from "@fitness/shared/domain/reviews/cycle-volume";
import type { Gender } from "@fitness/shared";

export const PLAN_PROMPT_VERSION = "plan.v3";

export type PlanPromptInput = {
  cycleId: string;
  startDate: Date;
  endDate: Date;
  primaryGoal: string;
  weeklyTrainingDays: number;
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
  reviewContext?: {
    processedSummary: string | null;
    conclusions: unknown;
    trainingVolume: CycleTrainingVolume;
  };
  model: string;
};

export function buildPlanRequest(input: PlanPromptInput): AiRequest {
  const context: Record<string, unknown> = {
    cycle: {
      id: input.cycleId,
      startDate: input.startDate.toISOString(),
      endDate: input.endDate.toISOString(),
    },
    profile: {
      primaryGoal: input.primaryGoal,
      weeklyTrainingDays: input.weeklyTrainingDays,
      sessionDurationMinutes: input.sessionDurationMinutes,
      gender: input.gender,
      age: input.age,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
    },
    legalExercisePool: input.exercises,
    outputShape: {
      workouts: [
        {
          scheduledDate: "ISO date",
          activityType: "STRENGTH | CARDIO | SPORT",
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
  };

  if (input.reviewContext) {
    context.previousCycleReview = input.reviewContext;
  }

  return {
    model: input.model,
    promptVersion: PLAN_PROMPT_VERSION,
    systemPrompt: [
      "You generate a seven-day weekly fitness plan as JSON only.",
      "Use only exercise IDs from the supplied legal exercise pool.",
      "Strength workouts must contain at least one exercise and one planned set per exercise.",
      "Do not return RPE, subjective feedback, or unknown fields.",
      "Keep every scheduled date within the inclusive seven-day cycle dates.",
      "Use the supplied body context as planning context; never invent or reinterpret values.",
      "Do not infer medical diagnoses, calorie prescriptions, nutrition plans, or unsupported safety claims from body context.",
    ].join(" "),
    userPrompt: JSON.stringify(context),
    metadata: {
      feature: "weekly-plan",
      cycleId: input.cycleId,
    },
  };
}
