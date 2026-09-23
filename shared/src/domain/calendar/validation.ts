import { z } from "zod";

const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDateKey(value: string): boolean {
  if (!dateKeyPattern.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

const calendarDateKeySchema = z
  .string()
  .refine(isCalendarDateKey, "must be a valid calendar date in YYYY-MM-DD format");

export const calendarRangeQuerySchema = z
  .object({
    from: calendarDateKeySchema,
    to: calendarDateKeySchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.from > value.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "to must be on or after from",
      });
    }
  });

export type CalendarRangeQuery = z.infer<typeof calendarRangeQuerySchema>;

export type CalendarDateRangeBounds = {
  from: Date;
  toExclusive: Date;
};

export function calendarDateRangeToUtcBounds(
  input: CalendarRangeQuery,
): CalendarDateRangeBounds {
  const from = new Date(`${input.from}T00:00:00.000Z`);
  const to = new Date(`${input.to}T00:00:00.000Z`);

  return {
    from,
    toExclusive: new Date(to.getTime() + 24 * 60 * 60 * 1000),
  };
}
