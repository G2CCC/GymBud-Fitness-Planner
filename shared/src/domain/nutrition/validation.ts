import { z } from "zod";
import { isValidTimeZone } from "../time/timezone";
export const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Choose a valid date");
export function nutritionLocalDate(at: Date, timezone: string): string {
  if (!Number.isFinite(at.getTime()) || !isValidTimeZone(timezone))
    throw new Error("Invalid date or timezone");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type)!.value)
    .join("-");
}
export const nutritionTotalsSchema = z.object({
  kcal: z.number().finite().nonnegative(),
  proteinG: z.number().finite().nonnegative(),
  carbsG: z.number().finite().nonnegative(),
  fatG: z.number().finite().nonnegative(),
});
const entryFields = {
  mealType: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
  quantity: z
    .number()
    .finite()
    .min(0.0001)
    .max(100000)
    .transform((n) => Math.round(n * 10000) / 10000),
  unit: z.enum(["g", "ea"]),
  expectedRevision: z.number().int().nonnegative(),
};
export const foodEntryInputSchema = z
  .object({
    ...entryFields,
    date: localDateSchema,
    foodId: z.string().min(1),
    portionId: z.string().min(1).optional(),
    clientRequestId: z.string().uuid(),
  })
  .strict();
export const foodEntryPatchSchema = z
  .object({
    ...entryFields,
    foodId: z.string().min(1).optional(),
    portionId: z.string().min(1).optional(),
  })
  .strict();
export const completionInputSchema = z
  .object({
    complete: z.boolean(),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();
