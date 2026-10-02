import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import { db } from "../../src/db";
import { FoodCatalog } from "../../src/nutrition/catalog";
describe.skipIf(!process.env.DATABASE_URL)("food catalog search", () => {
  const catalog = new FoodCatalog(db);
  afterAll(async () => {
    await db.food.deleteMany({ where: { sourceRelease: "search-fixture" } });
    await db.$disconnect();
  });
  it("paginates active foods and binds cursors to the query", async () => {
    await db.food.createMany({
      data: ["Apple raw", "Apple cooked", "Banana"].map((name, i) => ({
        name,
        sourceId: String(i),
        sourceProvider: "test",
        sourceRelease: "search-fixture",
        active: i < 2,
        kcalPer100g: 50,
        proteinPer100g: 1,
        carbsPer100g: 10,
        fatPer100g: 0,
      })),
    });
    const first = await catalog.search({ q: "apple", limit: 1 });
    const next = await catalog.search({
      q: "apple",
      limit: 1,
      cursor: first.nextCursor!,
    });
    expect(first.items[0].name).toBe("Apple cooked");
    expect(next.items[0].name).toBe("Apple raw");
    expect(next.nextCursor).toBeNull();
    expect(typeof first.items[0].per100g.kcal).toBe("number");
    expect((await catalog.search({ q: "banana" })).items).toHaveLength(0);
    await expect(
      catalog.search({ q: "banana", cursor: first.nextCursor! }),
    ).rejects.toThrow();
  });
});
