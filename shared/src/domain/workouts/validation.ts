import { z } from "zod";
import {
  activityTypes,
  locations,
} from "../enums";
import { plannedSetSchema, setLogSchema } from "../validation";

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

export const plannedExerciseInputSchema = z.object({
  exerciseId: z.string().trim().min(1),
  sortOrder: z.number().int().min(1),
  restSeconds: z.number().int().min(0).max(3600).optional(),
  sets: z.array(plannedSetSchema).min(1).max(100),
}).strict();

export const createWorkoutInputSchema = z.object({
  activityType: z.enum(activityTypes),
  scheduledDate: z.coerce.date(),
  location: z.enum(locations),
  durationMinutes: z.number().int().min(1).max(600),
  plannedDetails: z.record(z.unknown()).optional(),
  plannedExercises: z.array(plannedExerciseInputSchema).min(1).max(100).optional(),
}).strict().superRefine((input, context) => {
  if (input.plannedExercises && input.activityType !== "STRENGTH") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["plannedExercises"],
      message: "Only strength workouts can contain planned exercises",
    });
  }

  const sortOrders = input.plannedExercises?.map((exercise) => exercise.sortOrder) ?? [];
  if (new Set(sortOrders).size !== sortOrders.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["plannedExercises"],
      message: "Each planned exercise must have a unique sort order",
    });
  }

  input.plannedExercises?.forEach((exercise, exerciseIndex) => {
    const setNumbers = exercise.sets.map((set) => set.setNumber);
    if (new Set(setNumbers).size !== setNumbers.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["plannedExercises", exerciseIndex, "sets"],
        message: "Each planned set must have a unique set number",
      });
    }
  });
});

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
export type PlannedSetInput = z.infer<typeof plannedSetSchema>;
export type PlannedExerciseInput = z.infer<typeof plannedExerciseInputSchema>;
export type WorkoutLogInput =
  | StrengthWorkoutLogInput
  | CardioWorkoutLogInput
  | SportWorkoutLogInput;
export type CreateWorkoutInput = z.infer<typeof createWorkoutInputSchema>;
export type BackfillCompletionInput = z.infer<
  typeof backfillCompletionInputSchema
>;
export type RescheduleWorkoutInput = z.infer<
  typeof rescheduleWorkoutInputSchema
>;
export type UpdateWorkoutLocationInput = z.infer<
  typeof updateWorkoutLocationInputSchema
>;
