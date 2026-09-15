import { Router, type Response } from "express";
import { getAuthenticatedUserId } from "../../../../current-user";
import { createConfiguredAiClient } from "../../../../ai/client";
import {
  AiExerciseService,
  AiExerciseServiceError,
} from "../../../../ai/exercise-service";
import { db } from "../../../../db";

const exerciseService = new AiExerciseService(db, createConfiguredAiClient());

export const exerciseExtractionRouter = Router();

exerciseExtractionRouter.post("/", async (request, response) => {
  try {
    getAuthenticatedUserId(request);
    const draft = await exerciseService.extractExerciseMetadata(request.body);
    return response.json({ data: draft });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

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
