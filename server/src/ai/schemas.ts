import { z } from "zod";
import {
  activityTypes,
  customExerciseInputSchema,
  locations,
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

const planWorkoutSchema = z.object({
  scheduledDate: z.coerce.date(),
  activityType: z.enum(activityTypes),
  location: z.enum(locations),
  durationMinutes: z.number().int().min(1).max(600),
  plannedDetails: z.record(z.unknown()).optional(),
  exercises: z.array(planExerciseSchema),
}).strict();

export const planResponseSchema = z.object({
  workouts: z.array(planWorkoutSchema).min(1).max(28),
}).strict();

export const planDraftExerciseSchema = planExerciseSchema.extend({
  name: z.string().trim().min(1),
  equipment: z.string().nullable(),
  availableLocations: z.array(z.enum(locations)).min(1).max(2),
}).strict();

export const planDraftWorkoutSchema = planWorkoutSchema.extend({
  exercises: z.array(planDraftExerciseSchema),
}).strict();

export const planDraftSchema = z.object({
  cycleId: z.string().trim().min(1),
  model: z.string().trim().min(1),
  promptVersion: z.string().trim().min(1),
  workouts: z.array(planDraftWorkoutSchema).min(1).max(28),
}).strict();

export type PlanResponse = z.infer<typeof planResponseSchema>;
export type PlanDraft = z.infer<typeof planDraftSchema>;
export type PlanDraftWorkout = PlanDraft["workouts"][number];
