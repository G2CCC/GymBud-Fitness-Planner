import { Router, type Response } from "express";
import { profileInputSchema } from "@fitness/shared/domain/validation";
import { CycleService, CycleServiceError } from "../../cycles/service";
import { getCurrentUserId } from "../../current-user";
import { db } from "../../db";
import { z } from "zod";

const restoreWorkoutInputSchema = z.object({
  scheduledDate: z.coerce.date(),
}).strict();

const cycleService = new CycleService(db);

export const cycleRouter = Router();

cycleRouter.post("/", async (request, response) => {
  const parsed = profileInputSchema.safeParse(request.body);

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
    const draft = await cycleService.createDraft(userId, parsed.data);
    return response.status(201).json({ data: draft });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

cycleRouter.post("/:cycleId/close", async (request, response) => {
  try {
    const userId = await getCurrentUserId();
    const closed = await cycleService.close(
      userId,
      request.params.cycleId,
    );
    return response.json({ data: closed });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

cycleRouter.post(
  "/:cycleId/workouts/:workoutId/restore",
  async (request, response) => {
    const parsed = restoreWorkoutInputSchema.safeParse(request.body);

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
      const restored = await cycleService.restoreAutoCancelledWorkout(
        userId,
        request.params.cycleId,
        request.params.workoutId,
        parsed.data.scheduledDate,
      );
      return response.json({ data: restored });
    } catch (error) {
      return sendRouteError(response, error);
    }
  },
);

function sendRouteError(response: Response, error: unknown) {
  if (error instanceof CycleServiceError) {
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
