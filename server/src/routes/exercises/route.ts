import { Router, type Response } from "express";
import { customExerciseInputSchema, strengthFocusAreaSchema } from "@fitness/shared";
import {
  ExerciseService,
  ExerciseServiceError,
} from "../../exercises/service";
import { serializeExercise } from "../../catalog/service";
import { env } from "../../config/env";
import { getAuthenticatedUserId } from "../../current-user";
import { db } from "../../db";

const exerciseService = new ExerciseService(db);

export const exerciseRouter = Router();

exerciseRouter.get("/", async (request, response) => {
  try {
    const userId = getAuthenticatedUserId(request);
    const rawFocusArea = request.query.focusArea;
    const parsedFocusArea = rawFocusArea
      ? strengthFocusAreaSchema.safeParse(rawFocusArea)
      : { success: true as const, data: undefined };
    if (!parsedFocusArea.success) {
      return response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: parsedFocusArea.error.message,
        },
      });
    }

    const exercises = await exerciseService.listAvailableExercises(userId, {
      focusArea: parsedFocusArea.data,
    });
    return response.json({
      data: exercises.map((exercise) =>
        serializeExercise(exercise, {
          supabaseUrl: env.supabaseUrl,
          bucket: env.exerciseImageBucket,
        }),
      ),
    });
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
    const userId = getAuthenticatedUserId(request);
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
    const userId = getAuthenticatedUserId(request);
    const exercise = await exerciseService.getExercise(
      userId,
      request.params.exerciseId,
    );
    return response.json({
      data: serializeExercise(exercise, {
        supabaseUrl: env.supabaseUrl,
        bucket: env.exerciseImageBucket,
      }),
    });
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
