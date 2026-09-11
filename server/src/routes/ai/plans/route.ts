import { Router, type Response } from "express";
import { getCurrentUserId } from "../../../current-user";
import { createConfiguredAiClient } from "../../../ai/client";
import {
  PlanService,
  PlanServiceError,
} from "../../../ai/plan-service";
import { db } from "../../../db";

const planService = new PlanService(db, createConfiguredAiClient());

export const planRouter = Router();

planRouter.post("/:cycleId/generate", async (request, response) => {
  try {
    const userId = await getCurrentUserId();
    const draft = await planService.generateDraft(
      userId,
      request.params.cycleId,
    );
    return response.json({ data: draft });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

planRouter.post("/:cycleId/confirm", async (request, response) => {
  try {
    const userId = await getCurrentUserId();
    const cycle = await planService.confirmDraft(
      userId,
      request.params.cycleId,
      request.body,
    );
    return response.json({ data: cycle });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

function sendRouteError(response: Response, error: unknown) {
  if (error instanceof PlanServiceError) {
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
