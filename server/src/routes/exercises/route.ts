import { Router, type Response } from "express";
import {
  customExerciseInputSchema,
} from "@fitness/shared/domain/validation";
import { locations } from "@fitness/shared/domain/enums";
import { z } from "zod";
import {
  ExerciseService,
  ExerciseServiceError,
} from "../../exercises/service";
import { getCurrentUserId } from "../../current-user";
import { db } from "../../db";

const locationQuerySchema = z.object({
  location: z.enum(locations),
}).strict();

const exerciseService = new ExerciseService(db);

export const exerciseRouter = Router();

exerciseRouter.get("/", async (request, response) => {
  const parsed = locationQuerySchema.safeParse(request.query);

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
    const exercises = await exerciseService.listAvailableExercises(
      userId,
      parsed.data.location,
    );
    return response.json({ data: exercises });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

exerciseRouter.post("/", async (request, response) => {
  const parsed = customExerciseInputSchema.safeParse(request.body);

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
    const exercise = await exerciseService.createConfirmedCustomExercise(
      userId,
      parsed.data,
    );
    return response.status(201).json({ data: exercise });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

exerciseRouter.get("/:exerciseId", async (request, response) => {
  try {
    const userId = await getCurrentUserId();
    const exercise = await exerciseService.getExercise(
      userId,
      request.params.exerciseId,
    );
    return response.json({ data: exercise });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

function sendRouteError(response: Response, error: unknown) {
  if (error instanceof ExerciseServiceError) {
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
