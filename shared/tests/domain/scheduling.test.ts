import { describe, expect, it } from "vitest";
import { distributeFirstWeek } from "@fitness/shared/domain/scheduling/distribute-week";

describe("first-week scheduling", () => {
  it("distributes three sessions across the seven-day window", () => {
    const dates = distributeFirstWeek(new Date("2026-09-09T00:00:00Z"), 3);

    expect(dates.map((date) => date.toISOString().slice(0, 10))).toEqual([
      "2026-09-09",
      "2026-09-12",
      "2026-09-15",
    ]);
  });

  it("returns the start date when the user trains once per week", () => {
    const dates = distributeFirstWeek(new Date("2026-09-09T16:30:00Z"), 1);

    expect(dates).toEqual([new Date("2026-09-09T00:00:00Z")]);
  });

  it("rejects a training-day count outside the supported range", () => {
    expect(() =>
      distributeFirstWeek(new Date("2026-09-09T00:00:00Z"), 8),
    ).toThrow();
  });
});
