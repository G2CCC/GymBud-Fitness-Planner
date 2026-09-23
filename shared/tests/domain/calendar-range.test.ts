import { describe, expect, it } from "vitest";
import {
  calendarDateRangeToUtcBounds,
  calendarRangeQuerySchema,
} from "../../src/domain/calendar/validation";

describe("calendar date range validation", () => {
  it("turns an inclusive date range into UTC start and exclusive end bounds", () => {
    const bounds = calendarDateRangeToUtcBounds(
      calendarRangeQuerySchema.parse({ from: "2026-09-01", to: "2026-09-30" }),
    );

    expect(bounds.from).toEqual(new Date("2026-09-01T00:00:00.000Z"));
    expect(bounds.toExclusive).toEqual(new Date("2026-10-01T00:00:00.000Z"));
  });

  it("accepts a range that begins on a Sunday", () => {
    expect(
      calendarRangeQuerySchema.parse({ from: "2026-08-30", to: "2026-09-05" }),
    ).toEqual({ from: "2026-08-30", to: "2026-09-05" });
  });

  it("rejects malformed and reversed date ranges", () => {
    expect(() =>
      calendarRangeQuerySchema.parse({ from: "2026-9-01", to: "2026-09-30" }),
    ).toThrow();
    expect(() =>
      calendarRangeQuerySchema.parse({ from: "2026-10-01", to: "2026-09-30" }),
    ).toThrow();
  });
});
