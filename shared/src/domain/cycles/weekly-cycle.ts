import { addUtcDays, startOfUtcDay } from "../scheduling/distribute-week";

export type WeeklyCycleDateRange = {
  startDate: Date;
  endDate: Date;
};

export function getWeeklyCycleDateRange(startDate: Date): WeeklyCycleDateRange {
  const start = startOfUtcDay(startDate);
  return { startDate: start, endDate: addUtcDays(start, 6) };
}

export function getNextWeeklyCycleStart(
  previousEndDate: Date,
  currentLocalDate: Date,
): Date {
  const contiguousStart = addUtcDays(startOfUtcDay(previousEndDate), 1);
  const today = startOfUtcDay(currentLocalDate);
  return today.getTime() > contiguousStart.getTime() ? today : contiguousStart;
}
