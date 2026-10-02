import type { Response } from "express";
import { ZodError } from "zod";
import { NutritionError } from "@fitness/shared";
export function sendNutritionError(response: Response, error: unknown) {
  if (error instanceof NutritionError)
    return response
      .status(error.statusCode)
      .json({ error: { code: error.code, message: error.message } });
  if (error instanceof ZodError)
    return response
      .status(400)
      .json({
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message ?? "Invalid nutrition input",
        },
      });
  console.error(error);
  return response
    .status(500)
    .json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to save nutrition data",
      },
    });
}
