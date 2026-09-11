import { z } from "zod";
import {
  activityTypes,
  locations,
  plannedSetSchema,
} from "@fitness/shared";

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
