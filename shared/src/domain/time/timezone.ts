/**
 * GymBud stores calendar dates as UTC midnight values and stores the IANA
 * timezone that gives those values meaning. This keeps a date such as
 * 2026-10-08 independent from the server's timezone and from DST changes.
 * Actual event timestamps, such as completedAt, remain real instants.
 */

export function isValidTimeZone(timezone: string): boolean {
  if (typeof timezone !== "string" || timezone.trim().length === 0) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

export function assertValidTimeZone(timezone: string): void {
  if (!isValidTimeZone(timezone)) {
    throw new RangeError(`Invalid IANA timezone: ${timezone}`);
  }
}

/**
 * Returns UTC midnight for the calendar date represented by `date` in the
 * supplied timezone. The returned Date is a date-only value, not midnight in
 * the user's real-world timezone.
 */
export function startOfLocalDate(date: Date, timezone: string): Date {
  assertValidDate(date, "date");
  assertValidTimeZone(timezone);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = getPart(parts, "year");
  const month = getPart(parts, "month");
  const day = getPart(parts, "day");

  return new Date(Date.UTC(year, month - 1, day));
}

function getPart(
  parts: Intl.DateTimeFormatPart[],
  type: "year" | "month" | "day",
): number {
  const value = parts.find((part) => part.type === type)?.value;

  if (!value) {
    throw new Error(`Timezone formatter did not return a ${type}`);
  }

  return Number(value);
}

function assertValidDate(date: Date, label: string): void {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError(`${label} must be a valid Date`);
  }
}
