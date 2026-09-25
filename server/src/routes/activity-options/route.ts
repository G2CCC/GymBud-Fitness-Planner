import { Router, type Response } from "express";
import { activityOptionTypeSchema } from "@fitness/shared";
import { getAuthenticatedUserId } from "../../current-user";
import { db } from "../../db";
import { ActivityCatalogService } from "../../catalog/service";

const activityCatalogService = new ActivityCatalogService(db);
export const activityOptionRouter = Router();

activityOptionRouter.get("/", async (request, response) => {
  try {
    getAuthenticatedUserId(request);
    const rawType = request.query.activityType;
    const parsedType = rawType
      ? activityOptionTypeSchema.safeParse(rawType)
      : { success: true as const, data: undefined };
    if (!parsedType.success) {
      return response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: parsedType.error.message,
        },
      });
    }

    const options = await activityCatalogService.listActivityOptions(parsedType.data);
    return response.json({ data: options });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

function sendRouteError(response: Response, error: unknown) {
  console.error(error);
  return response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred while loading activities.",
    },
  });
}
