import "dotenv/config";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { db } from "../../src/db";
import { ProfileService } from "../../src/profiles/service";
import { NutritionDiary } from "../../src/nutrition/diary";
import { foodEntryInputSchema } from "@fitness/shared";
describe.skipIf(!process.env.DATABASE_URL)(
  "nutrition diary transactions",
  () => {
    const userId = randomUUID(),
      otherId = randomUUID();
    const now = new Date("2026-10-05T12:00:00Z");
    const diary = new NutritionDiary(db, () => now);
    let foodId: string, portionId: string;
    const entry = (date = "2026-10-01") => ({
      date,
      mealType: "BREAKFAST" as const,
      foodId,
      portionId,
      unit: "ea" as const,
      quantity: 2,
      expectedRevision: 0,
      clientRequestId: randomUUID(),
    });
    beforeAll(async () => {
      for (const id of [userId, otherId]) {
        await db.user.create({ data: { id, email: `${id}@diary.test` } });
        await new ProfileService(db).saveProfile(
          id,
          {
            sex: "MALE",
            age: 27,
            heightCm: 180,
            weightKg: 80,
            primaryGoal: "FAT_LOSS",
            weeklyTrainingDays: 3,
            sessionDurationMinutes: 60,
            recordingTimezone: "UTC",
          },
          new Date("2026-10-01T00:00:00Z"),
        );
      }
      const food = await db.food.create({
        data: {
          sourceProvider: userId,
          sourceId: "1",
          sourceRelease: "test",
          name: "Egg",
          kcalPer100g: 100,
          proteinPer100g: 10,
          carbsPer100g: 2,
          fatPer100g: 5,
          portions: {
            create: {
              sourcePortionId: "1",
              label: "large",
              quantity: 1,
              grams: 50,
              unitGrams: 50,
            },
          },
        },
        include: { portions: true },
      });
      foodId = food.id;
      portionId = food.portions[0].id;
    });
    afterAll(async () => {
      await db.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
      await db.foodPortion.deleteMany({
        where: { food: { sourceProvider: userId } },
      });
      await db.food.deleteMany({ where: { sourceProvider: userId } });
      await db.$disconnect();
    });
    it("deduplicates retries, rejects changed payload and never revives deleted requests", async () => {
      const input = entry();
      const first = await diary.add(userId, input);
      expect(first.entry.totals.kcal).toBe(100);
      expect(
        (await diary.add(userId, { ...input, expectedRevision: 99 })).entry.id,
      ).toBe(first.entry.id);
      await expect(
        diary.add(userId, { ...input, quantity: 3 }),
      ).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        diary.remove(otherId, first.entry.id, 1),
      ).rejects.toMatchObject({ statusCode: 404 });
      await diary.remove(userId, first.entry.id, 1);
      await expect(diary.add(userId, input)).rejects.toMatchObject({
        statusCode: 409,
      });
      expect(
        await db.foodLog.count({ where: { userId, deletedAt: null } }),
      ).toBe(0);
    });
    it("uses immutable nutrition and each snapshots when the catalog changes", async () => {
      const first = await diary.add(userId, entry("2026-10-02"));
      await diary.setCompletion(userId, "2026-10-02", {
        complete: true,
        expectedRevision: 1,
      });
      await db.food.update({
        where: { id: foodId },
        data: { active: false, kcalPer100g: 999 },
      });
      await db.foodPortion.update({
        where: { id: portionId },
        data: { unitGrams: 200, active: false },
      });
      const changed = await diary.update(userId, first.entry.id, {
        mealType: "LUNCH",
        unit: "ea",
        quantity: 3,
        expectedRevision: 2,
      });
      expect(changed.entry.totals.kcal).toBe(150);
      expect(changed.entry.grams).toBe(150);
      expect(
        (
          await db.nutritionDay.findUniqueOrThrow({
            where: { userId_localDate: { userId, localDate: "2026-10-02" } },
          })
        ).completedAt,
      ).toBeNull();
      await expect(
        diary.update(userId, first.entry.id, {
          mealType: "LUNCH",
          unit: "ea",
          quantity: 3,
          expectedRevision: 3,
          foodId,
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
      await db.food.update({ where: { id: foodId }, data: { active: true } });
      await db.foodPortion.update({
        where: { id: portionId },
        data: { active: true },
      });
    });
    it("rejects invalid dates, foreign portions and client supplied totals without mutations", async () => {
      for (const date of ["2026-09-30", "2026-10-06"])
        await expect(diary.add(userId, entry(date))).rejects.toMatchObject({
          statusCode: 400,
        });
      await expect(
        diary.add(userId, { ...entry(), portionId: "foreign" }),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(
        foodEntryInputSchema.safeParse({ ...entry(), kcal: 5 }).success,
      ).toBe(false);
    });
    it("serializes same-revision edits and lets the loser retry without lost entries", async () => {
      const a = entry("2026-10-03"),
        b = entry("2026-10-03");
      const results = await Promise.allSettled([
        diary.add(userId, a),
        diary.add(userId, b),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const failed = results.findIndex((r) => r.status === "rejected");
      expect((results[failed] as PromiseRejectedResult).reason.statusCode).toBe(
        409,
      );
      await diary.add(userId, { ...[a, b][failed], expectedRevision: 1 });
      expect(
        await db.foodLog.count({
          where: { day: { userId, localDate: a.date }, deletedAt: null },
        }),
      ).toBe(2);
    });
    it("confirms an empty day and conflicts completion against a simultaneous edit", async () => {
      expect(
        (
          await diary.setCompletion(userId, "2026-10-04", {
            complete: true,
            expectedRevision: 0,
          })
        ).completedAt,
      ).toBe(now.toISOString());
      const result = await Promise.allSettled([
        diary.setCompletion(userId, "2026-10-04", {
          complete: false,
          expectedRevision: 1,
        }),
        diary.add(userId, { ...entry("2026-10-04"), expectedRevision: 1 }),
      ]);
      expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    });
  },
);
