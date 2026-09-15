import { Router, type Response } from "express";
import { getAuthenticatedUserId } from "../../../current-user";
import { createConfiguredAiClient } from "../../../ai/client";
import {
  WeightService,
  WeightServiceError,
} from "../../../ai/weight-service";
import { db } from "../../../db";

const weightService = new WeightService(db, createConfiguredAiClient());

export const weightDecisionRouter = Router();

weightDecisionRouter.post(
  "/:recommendationId/decision",
  async (request, response) => {
    try {
      const userId = getAuthenticatedUserId(request);
      const workout = await weightService.applyWeightDecision(
        userId,
        request.params.recommendationId,
        request.body,
      );
      return response.json({ data: workout });
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
