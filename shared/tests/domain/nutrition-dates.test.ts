import { describe, it, expect } from "vitest";
import {
  localDateSchema,
  nutritionLocalDate,
} from "../../src/domain/nutrition/validation";
describe("nutrition local dates", () => {
  it("keeps Auckland midnight and DST local", () => {
    expect(
      nutritionLocalDate(new Date("2026-09-26T14:30:00Z"), "Pacific/Auckland"),
    ).toBe("2026-09-27");
    expect(
      nutritionLocalDate(new Date("2026-10-01T11:30:00Z"), "Pacific/Auckland"),
    ).toBe("2026-10-02");
  });
  it.each(["2026-02-30", "2026-2-03", "2026-13-01", "invalid"])(
    "rejects invalid date %s",
    (d) => expect(localDateSchema.safeParse(d).success).toBe(false),
  );
});
