import { z } from "zod";
import { locations } from "../enums";
import { validateExerciseLocations } from "./location";

export const customExerciseInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000).optional(),
  equipment: z.string().trim().min(1).max(100).nullable().optional(),
  targetMuscles: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  movementPattern: z.string().trim().min(1).max(80).optional(),
  availableLocations: z.array(z.enum(locations)).min(1).max(2),
}).strict().superRefine((input, context) => {
  try {
    validateExerciseLocations(input.equipment, input.availableLocations);
  } catch (error) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["availableLocations"],
      message: error instanceof Error ? error.message : "Invalid locations",
    });
  }
});
