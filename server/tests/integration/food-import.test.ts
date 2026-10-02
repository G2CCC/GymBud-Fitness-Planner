import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import { db } from "../../src/db";
import { importFoods } from "../../../scripts/foods/import";
const row = {
  status: "included" as const,
  sourceId: "fixture-food",
  name: "Fixture apple",
  per100g: { kcal: 52, proteinG: 0.3, carbsG: 14, fatG: 0.2 },
  portions: [],
};
describe.skipIf(!process.env.DATABASE_URL)("food import", () => {
  afterAll(async () => {
    await db.food.deleteMany({ where: { sourceRelease: "test-release" } });
    await db.$disconnect();
  });
  it("reuses source identities and deactivates removed entries", async () => {
    expect(
      (
        await importFoods(
          db,
          [row, { ...row, sourceId: "fixture-old" }],
          "test-release",
        )
      ).created,
    ).toBe(2);
    const before = await db.food.findFirstOrThrow({
      where: { sourceId: row.sourceId },
    });
    expect((await importFoods(db, [row], "test-release")).created).toBe(0);
    expect(
      (await db.food.findFirstOrThrow({ where: { sourceId: row.sourceId } }))
        .id,
    ).toBe(before.id);
    expect(
      (await db.food.findFirstOrThrow({ where: { sourceId: "fixture-old" } }))
        .active,
    ).toBe(false);
    await expect(importFoods(db, [], "test-release")).rejects.toThrow();
  });
});
