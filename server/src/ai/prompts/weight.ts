import type { AiRequest } from "../client";

export const weightRecommendationPromptVersion = "weight-recommendation.v2";

export type WeightContext = {
  recentPerformance: Array<{
    workoutId: string;
    scheduledDate: string;
    completedAt: string | null;
    sets: Array<{
      setNumber: number;
      reps: number;
      weight: number;
      weightUnit: "KG" | "LB";
    }>;
  }>;
  currentCycleSummary: {
    cycleId: string;
    startDate: string;
    endDate: string;
    workoutCount: number;
    completedWorkoutCount: number;
    cancelledWorkoutCount: number;
    plannedWorkoutCount: number;
  };
  allTimeBest: {
    weight: number;
    weightUnit: "KG" | "LB";
    reps: number;
    workoutId: string;
    recordedAt: string;
  } | null;
  currentGoal: {
    primaryGoal: string;
  };
  nextWorkoutTarget: {
    workoutId: string;
    scheduledDate: string;
    exerciseId: string;
    sets: number;
    targetReps: number | number[];
    plannedWeights: Array<{
      setNumber: number;
      weight: number | null;
      weightUnit: "KG" | "LB" | null;
    }>;
  };
};

export function buildWeightRecommendationRequest(
  exercise: { id: string; name: string; equipment: string | null },
  context: WeightContext,
  model: string,
): AiRequest {
  return {
    model,
    promptVersion: weightRecommendationPromptVersion,
    systemPrompt: [
      "Recommend one safe starting weight for the next planned strength workout.",
      "Use only the supplied training records and target.",
      "Return JSON only with recommendedWeight, weightUnit, reason, and confidence.",
      "Do not change historical records or future workouts beyond the supplied next target.",
      "If evidence is limited, make a conservative recommendation and use low confidence.",
    ].join(" "),
    userPrompt: JSON.stringify({
      exercise,
      context,
    }),
  };
}
