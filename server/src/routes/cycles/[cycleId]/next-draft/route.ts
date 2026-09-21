import { Router, type Response } from "express";
import { z } from "zod";
import { createConfiguredAiClient } from "../../../../ai/client";
import {
  CycleReviewService,
  CycleReviewServiceError,
} from "../../../../reviews/service";
import { CycleService } from "../../../../cycles/service";
import { PlanService } from "../../../../ai/plan-service";
import { getAuthenticatedUserId } from "../../../../current-user";
import { db } from "../../../../db";

const inputSchema = z.object({
  reviewId: z.string().trim().min(1),
}).strict();

const aiClient = createConfiguredAiClient();
const reviewService = new CycleReviewService(
  db,
  aiClient,
  new CycleService(db),
  new PlanService(db, aiClient),
);

export const nextCycleDraftRouter = Router({ mergeParams: true });

nextCycleDraftRouter.post<{ cycleId: string }>("/", async (request, response) => {
  const parsed = inputSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({
      error: { code: "VALIDATION_ERROR", message: parsed.error.message },
    });
  }

  try {
    const userId = getAuthenticatedUserId(request);
    const result = await reviewService.generateNextWeeklyDraft(
      userId,
      request.params.cycleId,
      parsed.data.reviewId,
    );
    return response.json({ data: result });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

function sendRouteError(response: Response, error: unknown) {
  if (error instanceof CycleReviewServiceError) {
    return response.status(error.statusCode).json({
      error: { code: error.code, message: error.message },
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
