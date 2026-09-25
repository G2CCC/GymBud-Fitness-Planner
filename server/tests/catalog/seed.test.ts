import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "../../src/db";
import { seedCatalog } from "../../src/catalog/seed";

describe.skipIf(!process.env.DATABASE_URL)("catalog seed", () => {
  it("is idempotent for Strength metadata and ActivityOptions", async () => {
    const first = await seedCatalog(db);
    const second = await seedCatalog(db);

    expect(second.strengthCount).toBe(first.strengthCount);
    expect(
      await db.exercise.count({ where: { sourceProvider: "free-exercise-db" } }),
    ).toBe(first.strengthCount);
    expect(await db.activityOption.count()).toBe(second.activityOptionCount);
    expect(
      await db.activityOption.count({ where: { activityType: "CARDIO" } }),
    ).toBe(12);
    expect(
      await db.activityOption.count({ where: { activityType: "SPORT" } }),
    ).toBe(18);
    expect(second.activityOptionCount).toBe(30);
  });
});

afterAll(async () => {
  await db.$disconnect();
});
