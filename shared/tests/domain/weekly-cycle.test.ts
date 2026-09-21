import { describe, expect, it } from "vitest";
import {
  getWeeklyCycleDateRange,
  getNextWeeklyCycleStart,
} from "@fitness/shared/domain/cycles/weekly-cycle";

describe("weekly cycle dates", () => {
  it("creates an inclusive seven-day range", () => {
    const range = getWeeklyCycleDateRange(new Date("2026-09-21T00:00:00Z"));

    expect(range.startDate.toISOString()).toBe("2026-09-21T00:00:00.000Z");
    expect(range.endDate.toISOString()).toBe("2026-09-27T00:00:00.000Z");
  });

  it("starts a delayed user's next week today when today is later", () => {
    expect(
      getNextWeeklyCycleStart(
        new Date("2026-09-27T00:00:00Z"),
        new Date("2026-10-05T00:00:00Z"),
      ).toISOString(),
    ).toBe("2026-10-05T00:00:00.000Z");
  });
});
