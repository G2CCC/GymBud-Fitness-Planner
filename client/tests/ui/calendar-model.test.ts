import { describe, expect, it } from "vitest";
import { getCalendarVisibleRange } from "../../src/features/calendar/calendar-model";

describe("calendar model", () => {
  it("requests the visible month range without shifting the date", () => {
    expect(
      getCalendarVisibleRange(
        new Date(2026, 7, 31),
        new Date(2026, 9, 5),
      ),
    ).toEqual({ from: "2026-08-31", to: "2026-10-04" });
  });

  it("supports a six-row month range", () => {
    expect(
      getCalendarVisibleRange(
        new Date(2026, 6, 27),
        new Date(2026, 8, 7),
      ),
    ).toEqual({ from: "2026-07-27", to: "2026-09-06" });
  });
});
