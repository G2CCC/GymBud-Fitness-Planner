export type CalendarVisibleRange = {
  from: string;
  to: string;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function dateKeyFromDate(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function getCalendarVisibleRange(
  start: Date,
  endExclusive: Date,
): CalendarVisibleRange {
  const lastVisibleDate = new Date(endExclusive);
  lastVisibleDate.setDate(lastVisibleDate.getDate() - 1);

  return {
    from: dateKeyFromDate(start),
    to: dateKeyFromDate(lastVisibleDate),
  };
}

export function isMonthKey(value: string | null): value is `${number}-${number}` {
  return value !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function currentMonthKey(now = new Date()): string {
  return dateKeyFromDate(now).slice(0, 7);
}

export function monthKeyFromDate(value: Date): string {
  return dateKeyFromDate(value).slice(0, 7);
}

export function monthKeyToInitialDate(monthKey: string): string {
  return `${monthKey}-01`;
}
