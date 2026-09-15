import type { AiRequest } from "../client";
import type { ObjectiveCycleSummary } from "@fitness/shared/domain/reviews/objective-summary";
import type { Gender, Location } from "@fitness/shared";

export const PLAN_PROMPT_VERSION = "plan.v2";

export type PlanPromptInput = {
  cycleId: string;
  startDate: Date;
  endDate: Date;
  primaryGoal: string;
  secondaryOutcome: string | null;
  weeklyTrainingDays: number;
  sessionDurationMinutes: number;
  location: Location;
  gender: Gender | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  exercises: Array<{
    id: string;
    name: string;
    equipment: string | null;
    targetMuscles: string[];
    movementPattern: string | null;
    availableLocations: string[];
  }>;
  reviewContext?: {
    processedSummary: string | null;
    conclusions: unknown;
    objectiveSummary: ObjectiveCycleSummary;
  };
  model: string;
};

export function buildPlanRequest(input: PlanPromptInput): AiRequest {
  const optionalProfileContext = Object.fromEntries(
    Object.entries({
      gender: input.gender,
      age: input.age,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
    }).filter(([, value]) => value !== null && value !== undefined),
  );

  const context: Record<string, unknown> = {
    cycle: {
      id: input.cycleId,
      startDate: input.startDate.toISOString(),
      endDate: input.endDate.toISOString(),
    },
    profile: {
      primaryGoal: input.primaryGoal,
      ...(input.secondaryOutcome
        ? { secondaryOutcome: input.secondaryOutcome }
        : {}),
      weeklyTrainingDays: input.weeklyTrainingDays,
      sessionDurationMinutes: input.sessionDurationMinutes,
      location: input.location,
      ...optionalProfileContext,
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
  };

  if (input.reviewContext) {
    context.previousCycleReview = input.reviewContext;
  }

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
      "Body context is optional planning context; never invent missing values.",
      "Do not infer medical diagnoses, calorie prescriptions, nutrition plans, or unsupported safety claims from body context.",
    ].join(" "),
    userPrompt: JSON.stringify(context),
    metadata: {
      feature: "four-week-plan",
      cycleId: input.cycleId,
    },
  };
}
