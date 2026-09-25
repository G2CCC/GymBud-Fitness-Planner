import { z } from "zod";
import {
  activityIconKeySchema,
  activityTypes,
  customExerciseInputSchema,
  plannedSetSchema,
  weightUnits,
} from "@fitness/shared";

export const exerciseExtractionInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
}).strict();

export const exerciseMetadataDraftSchema = customExerciseInputSchema;

const replacementSchema = z.object({
  exerciseId: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(500),
  restSeconds: z.number().int().min(0).max(3600).optional(),
  sets: z.array(plannedSetSchema).min(1).max(100),
}).strict();

export const replacementResponseSchema = z.object({
  replacements: z.array(replacementSchema).max(5),
}).strict();

export const weightRecommendationSchema = z.object({
  recommendedWeight: z.number().nonnegative(),
  weightUnit: z.enum(weightUnits),
  reason: z.string().trim().min(1).max(1000),
  confidence: z.enum(["low", "medium", "high"]),
}).strict();

export const weightDecisionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ACCEPT") }).strict(),
  z.object({
    action: z.literal("MODIFY"),
    weight: z.number().nonnegative(),
    weightUnit: z.enum(weightUnits),
  }).strict(),
  z.object({ action: z.literal("REJECT") }).strict(),
]);

export const singleDayPlanInputSchema = z.object({
  scheduledDate: z.coerce.date(),
  focusAreas: z.array(z.string().trim().min(1).max(80)).min(1).max(8),
}).strict();

export type ExerciseExtractionInput = z.infer<
  typeof exerciseExtractionInputSchema
>;
export type ExerciseMetadataDraft = z.infer<
  typeof exerciseMetadataDraftSchema
>;
export type ReplacementResponse = z.infer<typeof replacementResponseSchema>;
export type WeightRecommendationResponse = z.infer<
  typeof weightRecommendationSchema
>;
export type WeightDecision = z.infer<typeof weightDecisionSchema>;
export type SingleDayPlanInput = z.infer<typeof singleDayPlanInputSchema>;

export const cycleReviewResponseSchema = z.object({
  processedSummary: z.string().trim().min(1).max(5000),
  conclusions: z.object({
    status: z.enum(["CONTINUE", "ADJUST_PLAN", "RESET_REQUIRED"]),
    keyFindings: z.array(z.string().trim().min(1).max(500)).max(10),
    recommendations: z.array(z.string().trim().min(1).max(500)).max(10),
  }).strict(),
}).strict();

export type CycleReviewResponse = z.infer<typeof cycleReviewResponseSchema>;

const planExerciseSchema = z.object({
  exerciseId: z.string().trim().min(1),
  sortOrder: z.number().int().min(1),
  restSeconds: z.number().int().min(0).max(3600).optional(),
  sets: z.array(plannedSetSchema).min(1).max(100),
}).strict();

export const cardioDetailsSchema = z.object({
  modality: z.string().trim().min(1).max(80),
  distanceKm: z.number().nonnegative().optional(),
  paceSecondsPerKm: z.number().positive().optional(),
  speedKph: z.number().nonnegative().optional(),
  intensity: z.enum(["LOW", "MODERATE", "HIGH"]).optional(),
}).strict();

export const sportDetailsSchema = z.object({
  sportName: z.string().trim().min(1).max(80),
  trainingFocus: z.string().trim().min(1).max(200),
  intensity: z.enum(["LOW", "MODERATE", "HIGH"]).optional(),
}).strict();

const planWorkoutBaseSchema = z.object({
  scheduledDate: z.coerce.date(),
  activityType: z.enum(activityTypes),
  activityOptionId: z.string().trim().min(1).optional(),
  durationMinutes: z.number().int().min(1).max(600),
  plannedDetails: z.record(z.unknown()).optional(),
  exercises: z.array(planExerciseSchema),
}).strict();

const planWorkoutSchema = planWorkoutBaseSchema.superRefine((workout, context) => {
  if (workout.activityType === "STRENGTH") {
    if (workout.activityOptionId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["activityOptionId"],
        message: "Strength workouts cannot use an activity option",
      });
    }
    if (workout.exercises.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["exercises"],
        message: "Strength workouts require at least one exercise",
      });
    }
    return;
  }

  if (!workout.activityOptionId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["activityOptionId"],
      message: "Cardio and Sport workouts require an activity option",
    });
  }
  if (workout.exercises.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["exercises"],
      message: "Cardio and Sport workouts cannot contain strength exercises",
    });
  }
});

export const planResponseSchema = z.object({
  workouts: z.array(planWorkoutSchema).min(1).max(7),
}).strict();

export const singleDayPlanResponseSchema = z.object({
  workout: planWorkoutSchema,
}).strict();

export const planDraftExerciseSchema = planExerciseSchema.extend({
  name: z.string().trim().min(1),
  equipment: z.string().nullable(),
}).strict();

const planDraftWorkoutBaseSchema = planWorkoutBaseSchema.extend({
  activityOptionName: z.string().trim().min(1).optional(),
  activityOptionIconKey: activityIconKeySchema.optional(),
  exercises: z.array(planDraftExerciseSchema),
}).strict();

export const planDraftWorkoutSchema = planDraftWorkoutBaseSchema.superRefine(
  (workout, context) => {
    const displayFields = [
      workout.activityOptionName,
      workout.activityOptionIconKey,
    ];
    if (workout.activityType === "STRENGTH") {
      if (displayFields.some(Boolean)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["activityOptionName"],
          message: "Strength workouts cannot include activity option display fields",
        });
      }
      return;
    }

    if (!workout.activityOptionId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["activityOptionId"],
        message: "Cardio and Sport workouts require an activity option",
      });
    }
    if (!workout.activityOptionName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["activityOptionName"],
        message: "Activity option name is required for display",
      });
    }
    if (!workout.activityOptionIconKey) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["activityOptionIconKey"],
        message: "Activity option icon is required for display",
      });
    }
  },
);

export const planDraftSchema = z.object({
  cycleId: z.string().trim().min(1),
  model: z.string().trim().min(1),
  promptVersion: z.string().trim().min(1),
  workouts: z.array(planDraftWorkoutSchema).min(1).max(7),
}).strict();

export type PlanResponse = z.infer<typeof planResponseSchema>;
export type PlanDraft = z.infer<typeof planDraftSchema>;
export type PlanDraftWorkout = PlanDraft["workouts"][number];
