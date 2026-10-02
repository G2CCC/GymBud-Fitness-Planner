import { Router, type Response } from "express";
import { profileInputSchema } from "@fitness/shared/domain/validation";
import { getAuthenticatedUserId } from "../../current-user";
import { db } from "../../db";
import { NutritionError } from "@fitness/shared";
import { ProfileService, profileSelect } from "../../profiles/service";
const profiles = new ProfileService(db);

export const profileRouter = Router();

profileRouter.get("/", async (request, response) => {
  try {
    const userId = getAuthenticatedUserId(request);
    const profile = await db.userProfile.findUnique({
      where: { userId },
      select: profileSelect,
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
    const userId = getAuthenticatedUserId(request);
    const profile = await profiles.saveProfile(userId, parsed.data);

    return response.json({ data: profile });
  } catch (error) {
    return sendRouteError(response, error);
  }
});

function sendRouteError(response: Response, error: unknown) {
  if (error instanceof NutritionError) return response.status(error.statusCode).json({error:{code:error.code,message:error.message}});
  console.error(error);
  return response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected profile error occurred",
    },
  });
}
