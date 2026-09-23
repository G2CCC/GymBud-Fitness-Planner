import { Router, type Response } from "express";
import {
  calendarDateRangeToUtcBounds,
  calendarRangeQuerySchema,
} from "@fitness/shared";
import { getAuthenticatedUserId } from "../../current-user";
import { CalendarService } from "../../calendar/service";
import { db } from "../../db";

const calendarService = new CalendarService(db);

export const calendarRouter = Router();

calendarRouter.get("/", async (request, response) => {
  const parsed = calendarRangeQuerySchema.safeParse({
    from: request.query.from,
    to: request.query.to,
  });

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
    const workouts = await calendarService.listWorkouts(
      userId,
      calendarDateRangeToUtcBounds(parsed.data),
    );
    return response.json({ data: { workouts } });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

function sendRouteError(response: Response, error: unknown) {
  console.error(error);
  return response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred while loading the calendar.",
    },
  });
}
