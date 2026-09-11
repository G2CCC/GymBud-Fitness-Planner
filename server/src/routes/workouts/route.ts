import { Router, type Response } from "express";
import {
  backfillCompletionInputSchema,
  extraWorkoutInputSchema,
  rescheduleWorkoutInputSchema,
  updateWorkoutLocationInputSchema,
} from "@fitness/shared/domain/workouts/validation";
import { z } from "zod";
import {
  WorkoutService,
  WorkoutServiceError,
} from "../../workouts/service";
import { getCurrentUserId } from "../../current-user";
import { db } from "../../db";

const completeWorkoutInputSchema = z.object({
  completedAt: z.coerce.date().optional(),
  log: z.unknown().optional(),
}).strict();

const workoutService = new WorkoutService(db);

export const workoutRouter = Router();

workoutRouter.post("/", async (request, response) => {
  const parsed = extraWorkoutInputSchema.safeParse(request.body);

  if (!parsed.success) {
    return sendValidationError(response, parsed.error);
  }

  try {
    const userId = await getCurrentUserId();
    const workout = await workoutService.createExtraWorkout(userId, parsed.data);
    return response.status(201).json({ data: workout });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

workoutRouter.get("/:workoutId", async (request, response) => {
  try {
    const userId = await getCurrentUserId();
    const workout = await workoutService.getWorkout(
      userId,
      request.params.workoutId,
    );
    return response.json({ data: workout });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

workoutRouter.post("/:workoutId/complete", async (request, response) => {
  const parsed = completeWorkoutInputSchema.safeParse(request.body ?? {});

  if (!parsed.success) {
    return sendValidationError(response, parsed.error);
  }

  try {
    const userId = await getCurrentUserId();
    const workout = await workoutService.completeWorkout(
      userId,
      request.params.workoutId,
      parsed.data,
    );
    return response.json({ data: workout });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

workoutRouter.post("/:workoutId/backfill", async (request, response) => {
  const parsed = backfillCompletionInputSchema.safeParse(request.body);

  if (!parsed.success) {
    return sendValidationError(response, parsed.error);
  }

  try {
    const userId = await getCurrentUserId();
    const workout = await workoutService.backfillWorkout(
      userId,
      request.params.workoutId,
      parsed.data,
    );
    return response.json({ data: workout });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

workoutRouter.post("/:workoutId/cancel", async (request, response) => {
  try {
    const userId = await getCurrentUserId();
    const workout = await workoutService.cancelWorkout(
      userId,
      request.params.workoutId,
    );
    return response.json({ data: workout });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

workoutRouter.post("/:workoutId/reschedule", async (request, response) => {
  const parsed = rescheduleWorkoutInputSchema.safeParse(request.body);

  if (!parsed.success) {
    return sendValidationError(response, parsed.error);
  }

  try {
    const userId = await getCurrentUserId();
    const workout = await workoutService.rescheduleWorkout(
      userId,
      request.params.workoutId,
      parsed.data.scheduledDate,
    );
    return response.json({ data: workout });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

workoutRouter.patch("/:workoutId/location", async (request, response) => {
  const parsed = updateWorkoutLocationInputSchema.safeParse(request.body);

  if (!parsed.success) {
    return sendValidationError(response, parsed.error);
  }

  try {
    const userId = await getCurrentUserId();
    const workout = await workoutService.updateWorkoutLocation(
      userId,
      request.params.workoutId,
      parsed.data.location,
    );
    return response.json({ data: workout });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

workoutRouter.put("/:workoutId/log", async (request, response) => {
  try {
    const userId = await getCurrentUserId();
    const log = await workoutService.saveWorkoutLog(
      userId,
      request.params.workoutId,
      request.body,
    );
    return response.json({ data: log });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

function sendValidationError(response: Response, error: z.ZodError) {
  return response.status(400).json({
    error: {
      code: "VALIDATION_ERROR",
      message: error.message,
    },
  });
}

function sendRouteError(response: Response, error: unknown) {
  if (error instanceof WorkoutServiceError) {
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
