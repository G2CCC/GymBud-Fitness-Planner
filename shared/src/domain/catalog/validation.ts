import { z } from "zod";
import { activityIconKeys, strengthFocusAreas } from "./types";

export const strengthFocusAreaSchema = z.enum(strengthFocusAreas);
export const activityOptionTypeSchema = z.enum(["CARDIO", "SPORT"] as const);
export const activityIconKeySchema = z.enum(activityIconKeys);

export const catalogFilterSchema = z.object({
  focusArea: strengthFocusAreaSchema.optional(),
  activityType: activityOptionTypeSchema.optional(),
});
