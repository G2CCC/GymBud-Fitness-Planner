import { Router, type Response } from "express";
import { Prisma } from "@prisma/client";
import { cycleDraftInputSchema, timeZoneSchema } from "@fitness/shared/domain/validation";
import { CycleService, CycleServiceError } from "../../cycles/service";
import { getAuthenticatedUserId } from "../../current-user";
import { db } from "../../db";
import { z } from "zod";
import { cycleReviewRouter } from "./[cycleId]/review/route";
import { nextCycleDraftRouter } from "./[cycleId]/next-draft/route";
import { createConfiguredAiClient } from "../../ai/client";
import { CycleReviewService } from "../../reviews/service";

const activateCycleInputSchema = z.object({
  timezone: timeZoneSchema,
}).strict();

const cycleService = new CycleService(db);
const cycleReviewService = new CycleReviewService(
  db,
  createConfiguredAiClient(),
  cycleService,
);

export const cycleRouter = Router();

cycleRouter.get("/current", async (request, response) => {
  try {
    const userId = getAuthenticatedUserId(request);
    const activeCycle = await db.trainingCycle.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { startDate: "desc" },
      select: currentCycleSelect,
    });
    const cycle =
      activeCycle ??
      (await db.trainingCycle.findFirst({
        where: { userId, status: "DRAFT" },
        orderBy: { startDate: "desc" },
        select: currentCycleSelect,
      })) ??
      (await db.trainingCycle.findFirst({
        where: { userId, status: "CLOSED" },
        orderBy: { endDate: "desc" },
        select: currentCycleSelect,
      }));

    if (!cycle) {
      return response.json({ data: { cycle: null } });
    }

    const { reviewSnapshot, ...cycleData } = cycle;

    const reviewStatus =
      cycle.status === "ACTIVE"
        ? await cycleService.getReviewStatus(userId, cycle.id)
        : null;
    const weeklyReview =
      cycle.status === "ACTIVE" || cycle.status === "CLOSED"
        ? await cycleReviewService.processDueWeeklyCycle(userId, cycle.id)
        : null;

    return response.json({
      data: {
        cycle: {
          ...cycleData,
          workouts: cycleData.workouts.map(({ workoutLog, ...workout }) => ({
            ...workout,
            actualDetails: toActualDetails(workoutLog?.actualDetails),
            actualExercises: workoutLog?.exerciseLogs.map((exercise) => ({
              exerciseId: exercise.exerciseId,
              sortOrder: exercise.sortOrder,
              sets: exercise.setLogs.map((set) => ({
                setNumber: set.setNumber,
                actualReps: set.actualReps,
                actualWeight: set.actualWeight,
                weightUnit: set.weightUnit,
              })),
            })),
          })),
          reviewStatus,
          reviewAvailable: Boolean(reviewStatus?.reviewAvailable || weeklyReview),
          weeklyReview,
        },
      },
    });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

cycleRouter.post("/", async (request, response) => {
  const parsed = cycleDraftInputSchema.safeParse(request.body);

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
    const draft = await cycleService.createDraft(userId, parsed.data);
    return response.status(201).json({ data: draft });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

cycleRouter.post("/:cycleId/activate", async (request, response) => {
  const parsed = activateCycleInputSchema.safeParse(request.body);

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
    const active = await cycleService.activateDraft(
      userId,
      request.params.cycleId,
      parsed.data.timezone,
    );
    return response.json({ data: active });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

cycleRouter.get("/:cycleId/review-status", async (request, response) => {
  try {
    const userId = getAuthenticatedUserId(request);
    const reviewStatus = await cycleService.getReviewStatus(
      userId,
      request.params.cycleId,
    );
    return response.json({ data: reviewStatus });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

cycleRouter.post("/:cycleId/close", async (request, response) => {
  try {
    const userId = getAuthenticatedUserId(request);
    const closed = await cycleService.close(
      userId,
      request.params.cycleId,
    );
    return response.json({ data: closed });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

cycleRouter.use("/:cycleId/review", cycleReviewRouter);
cycleRouter.use("/:cycleId/next-draft", nextCycleDraftRouter);

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

const currentCycleSelect = {
  id: true,
  status: true,
  cycleNumber: true,
  startDate: true,
  endDate: true,
  timezone: true,
  reviewSnapshot: {
    select: { processedSummary: true },
  },
  workouts: {
    orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      activityType: true,
      scheduledDate: true,
      durationMinutes: true,
      status: true,
      completedAt: true,
      rescheduleCount: true,
      plannedDetails: true,
      workoutLog: {
        select: {
          actualDetails: true,
          exerciseLogs: {
            orderBy: { sortOrder: "asc" },
            select: {
              exerciseId: true,
              sortOrder: true,
              setLogs: {
                orderBy: { setNumber: "asc" },
                select: {
                  setNumber: true,
                  actualReps: true,
                  actualWeight: true,
                  weightUnit: true,
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.TrainingCycleSelect;

function toActualDetails(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value;
}
