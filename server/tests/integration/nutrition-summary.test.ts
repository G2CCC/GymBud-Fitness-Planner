import "dotenv/config";
import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import { db } from "../../src/db";
import { loadCycleNutrition } from "../../src/nutrition/summary";
describe.skipIf(!process.env.DATABASE_URL)("cycle nutrition loader", () => {
  it("loads the actual inclusive cycle window without inventing targets for absent days", async () => {
    const id = randomUUID();
    await db.user.create({ data: { id, email: `${id}@summary.test` } });
    try {
      await db.nutritionDay.create({
        data: {
          userId: id,
          localDate: "2026-09-24",
          timezone: "Pacific/Auckland",
          completedAt: new Date("2026-09-24"),
        },
      });
      const days = await db.$transaction((tx) =>
        loadCycleNutrition(tx, id, {
          startDate: "2026-09-21",
          endDate: "2026-09-27",
        }),
      );
      expect(days).toHaveLength(7);
      expect(days[3]).toMatchObject({
        date: "2026-09-24",
        recorded: true,
        target: null,
        timezone: "Pacific/Auckland",
      });
      expect(days[0].recorded).toBe(false);
      expect(await db.nutritionTarget.count({ where: { userId: id } })).toBe(0);
    } finally {
      await db.user.delete({ where: { id } });
      await db.$disconnect();
    }
  });
});
