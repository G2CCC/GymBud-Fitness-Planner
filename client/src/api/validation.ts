import { z } from "zod";
import {
  activityTypes,
  backfillCompletionInputSchema,
  createWorkoutInputSchema,
  profileInputSchema,
  rescheduleWorkoutInputSchema,
  weightUnits,
} from "@fitness/shared";

const planDraftExerciseSchema = z.object({
  exerciseId: z.string().trim().min(1),
  sortOrder: z.number().int().min(1),
  restSeconds: z.number().int().min(0).optional(),
  sets: z.array(
    z.object({
      setNumber: z.number().int().min(1),
      targetReps: z.number().int().min(1),
      plannedWeight: z.number().nonnegative().optional(),
      weightUnit: z.enum(weightUnits).optional(),
    }).strict(),
  ).min(1),
  name: z.string().trim().min(1),
  equipment: z.string().nullable(),
}).strict();

export const clientPlanDraftSchema = z.object({
  cycleId: z.string().trim().min(1),
  model: z.string().trim().min(1),
  promptVersion: z.string().trim().min(1),
  workouts: z.array(
    z.object({
      scheduledDate: z.coerce.date(),
      activityType: z.enum(activityTypes),
      durationMinutes: z.number().int().min(1).max(600),
      plannedDetails: z.record(z.unknown()).optional(),
      exercises: z.array(planDraftExerciseSchema),
    }).strict(),
  ).min(1).max(28),
}).strict();

export {
  backfillCompletionInputSchema,
  createWorkoutInputSchema,
  profileInputSchema,
  rescheduleWorkoutInputSchema,
};
