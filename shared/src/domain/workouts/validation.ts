import { z } from "zod";
import {
  activityTypes,
  locations,
} from "../enums";
import { setLogSchema } from "../validation";

const strengthSetLogInputSchema = setLogSchema.extend({
  setNumber: z.number().int().min(1),
}).strict();

const strengthExerciseLogInputSchema = z.object({
  exerciseId: z.string().trim().min(1),
  sortOrder: z.number().int().min(1),
  sets: z.array(strengthSetLogInputSchema).min(1).max(100),
}).strict();

export const strengthWorkoutLogInputSchema = z.object({
  exercises: z.array(strengthExerciseLogInputSchema).min(1).max(100),
}).strict();

export const cardioWorkoutLogInputSchema = z.object({
  actualDurationMinutes: z.number().int().min(1).max(600),
  distanceKm: z.number().nonnegative().optional(),
  paceSecondsPerKm: z.number().positive().optional(),
  speedKph: z.number().nonnegative().optional(),
  intensity: z.enum(["LOW", "MODERATE", "HIGH"]).optional(),
  modality: z.string().trim().min(1).max(80).optional(),
}).strict();

export const sportWorkoutLogInputSchema = z.object({
  actualDurationMinutes: z.number().int().min(1).max(600),
  intensity: z.enum(["LOW", "MODERATE", "HIGH"]).optional(),
  sportName: z.string().trim().min(1).max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
}).strict();

export const extraWorkoutInputSchema = z.object({
  activityType: z.enum(activityTypes),
  scheduledDate: z.coerce.date(),
  location: z.enum(locations),
  durationMinutes: z.number().int().min(1).max(600),
  plannedDetails: z.record(z.unknown()).optional(),
}).strict();

export const backfillCompletionInputSchema = z.object({
  completedAt: z.coerce.date(),
}).strict();

export const rescheduleWorkoutInputSchema = z.object({
  scheduledDate: z.coerce.date(),
}).strict();

export const updateWorkoutLocationInputSchema = z.object({
  location: z.enum(locations),
}).strict();

export type StrengthWorkoutLogInput = z.infer<
  typeof strengthWorkoutLogInputSchema
>;
export type CardioWorkoutLogInput = z.infer<
  typeof cardioWorkoutLogInputSchema
>;
export type SportWorkoutLogInput = z.infer<typeof sportWorkoutLogInputSchema>;
export type WorkoutLogInput =
  | StrengthWorkoutLogInput
  | CardioWorkoutLogInput
  | SportWorkoutLogInput;
export type ExtraWorkoutInput = z.infer<typeof extraWorkoutInputSchema>;
export type BackfillCompletionInput = z.infer<
  typeof backfillCompletionInputSchema
>;
export type RescheduleWorkoutInput = z.infer<
  typeof rescheduleWorkoutInputSchema
>;
export type UpdateWorkoutLocationInput = z.infer<
  typeof updateWorkoutLocationInputSchema
>;
