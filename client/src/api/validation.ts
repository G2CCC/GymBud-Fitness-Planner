import { z } from "zod";
import {
  activityIconKeySchema,
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

const clientPlanDraftWorkoutSchema = z.object({
  scheduledDate: z.coerce.date(),
  activityType: z.enum(activityTypes),
  activityOptionId: z.string().trim().min(1).optional(),
  activityOptionName: z.string().trim().min(1).optional(),
  activityOptionIconKey: activityIconKeySchema.optional(),
  durationMinutes: z.number().int().min(1).max(600),
  plannedDetails: z.record(z.unknown()).optional(),
  exercises: z.array(planDraftExerciseSchema),
}).strict().superRefine((workout, context) => {
  if (workout.activityType === "STRENGTH") {
    if (
      workout.activityOptionId ||
      workout.activityOptionName ||
      workout.activityOptionIconKey
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["activityOptionId"],
        message: "Strength workouts cannot include an activity option",
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
  if (!workout.activityOptionName) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["activityOptionName"],
      message: "Activity option name is required",
    });
  }
  if (!workout.activityOptionIconKey) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["activityOptionIconKey"],
      message: "Activity option icon is required",
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

export const clientPlanDraftSchema = z.object({
  cycleId: z.string().trim().min(1),
  model: z.string().trim().min(1),
  promptVersion: z.string().trim().min(1),
  workouts: z.array(clientPlanDraftWorkoutSchema).min(1).max(28),
}).strict();

export {
  backfillCompletionInputSchema,
  createWorkoutInputSchema,
  profileInputSchema,
  rescheduleWorkoutInputSchema,
};
