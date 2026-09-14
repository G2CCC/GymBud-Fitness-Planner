import { Router, type Response } from "express";
import { profileInputSchema } from "@fitness/shared/domain/validation";
import { getCurrentUserId } from "../../current-user";
import { db } from "../../db";

export const profileRouter = Router();

profileRouter.get("/", async (_request, response) => {
  try {
    const userId = await getCurrentUserId();
    const profile = await db.userProfile.findUnique({
      where: { userId },
      select: {
        weeklyTrainingDays: true,
        sessionDurationMinutes: true,
        defaultLocation: true,
        primaryGoal: true,
        secondaryOutcome: true,
      },
    });

    return response.json({ data: profile });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

profileRouter.put("/", async (request, response) => {
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
    const profile = await db.userProfile.upsert({
      where: { userId },
      update: parsed.data,
      create: { userId, ...parsed.data },
      select: {
        weeklyTrainingDays: true,
        sessionDurationMinutes: true,
        defaultLocation: true,
        primaryGoal: true,
        secondaryOutcome: true,
      },
    });

    return response.json({ data: profile });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

function sendRouteError(response: Response, error: unknown) {
  console.error(error);
  return response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected profile error occurred",
    },
  });
}
