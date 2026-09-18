import { z } from "zod";

export const customExerciseInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000).optional(),
  equipment: z.string().trim().min(1).max(100).nullable().optional(),
  targetMuscles: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  movementPattern: z.string().trim().min(1).max(80).optional(),
}).strict();
