const MIN_TRAINING_DAYS = 1;
const MAX_TRAINING_DAYS = 7;

export function startOfUtcDay(date: Date): Date {
  assertValidDate(date, "start date");

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function addUtcDays(date: Date, days: number): Date {
  assertValidDate(date, "date");

  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function distributeFirstWeek(
  start: Date,
  trainingDays: number,
): Date[] {
  if (
    !Number.isInteger(trainingDays) ||
    trainingDays < MIN_TRAINING_DAYS ||
    trainingDays > MAX_TRAINING_DAYS
  ) {
    throw new RangeError("trainingDays must be an integer between 1 and 7");
  }

  const firstDay = startOfUtcDay(start);

  if (trainingDays === 1) {
    return [firstDay];
  }

  return Array.from({ length: trainingDays }, (_, index) => {
    const offset = Math.round((index * 6) / (trainingDays - 1));
    return addUtcDays(firstDay, offset);
  });
}

function assertValidDate(date: Date, label: string): void {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError(`${label} must be a valid Date`);
  }
}
