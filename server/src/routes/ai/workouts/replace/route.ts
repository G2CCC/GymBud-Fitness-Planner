import { Router, type Response } from "express";
import { z } from "zod";
import { getCurrentUserId } from "../../../../current-user";
import { createConfiguredAiClient } from "../../../../ai/client";
import {
  AiExerciseService,
  AiExerciseServiceError,
} from "../../../../ai/exercise-service";
import { db } from "../../../../db";

const replacementInputSchema = z.object({
  exerciseId: z.string().trim().min(1),
}).strict();

const exerciseService = new AiExerciseService(db, createConfiguredAiClient());

export const exerciseReplacementRouter = Router();

exerciseReplacementRouter.post(
  "/:workoutId/replace",
  async (request, response) => {
    const parsed = replacementInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.message,
        },
      });
    }

    try {
      const userId = await getCurrentUserId();
      const replacements = await exerciseService.getCompatibleReplacements(
        userId,
        request.params.workoutId,
        parsed.data.exerciseId,
      );
      return response.json({ data: replacements });
    } catch (error) {
      return sendRouteError(response, error);
    }
  },
);

function sendRouteError(response: Response, error: unknown) {
  if (error instanceof AiExerciseServiceError) {
    return response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  console.error(error);
  return response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected server error occurred",
    },
  });
}
