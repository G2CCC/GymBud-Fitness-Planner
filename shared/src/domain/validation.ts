import { z } from "zod";
import {
  activityTypes,
  genders,
  locations,
  weightUnits,
  workoutStatuses,
} from "./enums";
import { isValidTimeZone } from "./time/timezone";

const dateSchema = z.coerce.date();

export const profileInputSchema = z.object({
  weeklyTrainingDays: z.number().int().min(1).max(7),
  sessionDurationMinutes: z.number().int().min(10).max(360),
  defaultLocation: z.enum(locations),
  primaryGoal: z.string().trim().min(1),
  secondaryOutcome: z.string().trim().min(1).nullish(),
  gender: z.enum(genders).nullish(),
  age: z.number().int().min(13).max(100).nullish(),
  heightCm: z.number().min(50).max(250).nullish(),
  weightKg: z.number().min(20).max(350).nullish(),
}).strict();

export const timeZoneSchema = z.string().trim().min(1).refine(isValidTimeZone, {
  message: "timezone must be a valid IANA timezone",
});

export const cycleDraftInputSchema = profileInputSchema.extend({
  timezone: timeZoneSchema,
}).strict();

export { customExerciseInputSchema } from "./exercises/validation";

export const scheduledWorkoutInputSchema = z.object({
  activityType: z.enum(activityTypes),
  scheduledDate: dateSchema,
  location: z.enum(locations),
  durationMinutes: z.number().int().min(1).max(600),
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
