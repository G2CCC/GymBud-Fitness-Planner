import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "../../src/db";

describe.skipIf(!process.env.DATABASE_URL)("nutrition schema", () => {
  const id = randomUUID();
  afterAll(async () => {
    await db.user.deleteMany({ where: { id } });
    await db.$disconnect();
  });
  it("keeps one day per user and preserves its timezone", async () => {
    await db.user.create({ data: { id, email: `${id}@test.example` } });
    await db.nutritionDay.create({
      data: {
        userId: id,
        localDate: "2026-10-02",
        timezone: "Pacific/Auckland",
      },
    });
    await expect(
      db.nutritionDay.create({
        data: { userId: id, localDate: "2026-10-02", timezone: "UTC" },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    expect(await db.nutritionDay.count({ where: { userId: id } })).toBe(1);
  });
});
