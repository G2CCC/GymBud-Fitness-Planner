import { Router, type Response } from "express";
import { z } from "zod";
import { getCurrentUserId } from "../../../../current-user";
import { createConfiguredAiClient } from "../../../../ai/client";
import {
  WeightService,
  WeightServiceError,
} from "../../../../ai/weight-service";
import { db } from "../../../../db";

const weightRecommendationInputSchema = z.object({
  nextWorkoutId: z.string().trim().min(1),
}).strict();

const weightService = new WeightService(db, createConfiguredAiClient());

export const weightRecommendationRouter = Router();

weightRecommendationRouter.post(
  "/:exerciseId/weight",
  async (request, response) => {
    const parsed = weightRecommendationInputSchema.safeParse(request.body);
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
      const recommendation = await weightService.recommendNextWeight(
        userId,
        request.params.exerciseId,
        parsed.data.nextWorkoutId,
      );
      return response.json({ data: recommendation });
    } catch (error) {
      return sendRouteError(response, error);
    }
  },
);

function sendRouteError(response: Response, error: unknown) {
  if (error instanceof WeightServiceError) {
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
