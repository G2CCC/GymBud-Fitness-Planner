import { z } from "zod";
import {
  activityTypes,
  locations,
  weightUnits,
  workoutSources,
  workoutStatuses,
} from "./enums";

const dateSchema = z.coerce.date();

export const profileInputSchema = z.object({
  weeklyTrainingDays: z.number().int().min(1).max(7),
  sessionDurationMinutes: z.number().int().min(10).max(360),
  defaultLocation: z.enum(locations),
  primaryGoal: z.string().trim().min(1),
  secondaryOutcome: z.string().trim().min(1).optional(),
}).strict();

export const scheduledWorkoutInputSchema = z.object({
  activityType: z.enum(activityTypes),
  scheduledDate: dateSchema,
  location: z.enum(locations),
  durationMinutes: z.number().int().min(1).max(600),
  source: z.enum(workoutSources),
  status: z.enum(workoutStatuses).optional(),
}).strict();

export const plannedSetSchema = z.object({
  setNumber: z.number().int().min(1),
  targetReps: z.number().int().min(1).max(1000),
  plannedWeight: z.number().nonnegative().optional(),
  weightUnit: z.enum(weightUnits).optional(),
}).strict();

export const setLogSchema = z.object({
  weight: z.number().nonnegative().optional(),
  reps: z.number().int().min(0).max(1000),
  weightUnit: z.enum(weightUnits).optional(),
}).strict();
