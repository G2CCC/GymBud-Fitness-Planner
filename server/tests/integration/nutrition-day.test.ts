import "dotenv/config";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, it, expect, describe } from "vitest";
import { db } from "../../src/db";
import { ProfileService } from "../../src/profiles/service";
import { NutritionDays } from "../../src/nutrition/day";
import { NutritionDiary } from "../../src/nutrition/diary";
describe.skipIf(!process.env.DATABASE_URL)("nutrition daily read model", () => {
  const userId = randomUUID();
  const now = new Date("2026-09-28T12:00:00Z");
  const days = new NutritionDays(db, () => now);
  beforeAll(async () => {
    await db.user.create({ data: { id: userId, email: `${userId}@day.test` } });
    await new ProfileService(db).saveProfile(
      userId,
      {
        sex: "MALE",
        age: 27,
        heightCm: 180,
        weightKg: 80,
        primaryGoal: "FAT_LOSS",
        weeklyTrainingDays: 3,
        sessionDurationMinutes: 60,
        recordingTimezone: "Pacific/Auckland",
      },
      new Date("2026-09-27T00:00:00Z"),
    );
  });
  afterAll(async () => {
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });
  it("reads a blank no-cycle day without creating rows, and accepts local today across DST", async () => {
    const result = await days.getDay(userId, "2026-09-29");
    expect(result).toMatchObject({
      revision: 0,
      recorded: false,
      food: { kcal: 0 },
      exercise: { estimatedKcal: 0, coverage: "COMPLETE" },
      target: { kcal: 1939 },
    });
    expect(await db.nutritionDay.count({ where: { userId } })).toBe(0);
    for (const date of ["2026-09-26", "2026-09-30"])
      await expect(days.getDay(userId, date)).rejects.toMatchObject({
        statusCode: 400,
      });
  });
  it("keeps an explicitly empty completed day and its timezone after travel", async () => {
    await new NutritionDiary(db, () => now).setCompletion(
      userId,
      "2026-09-27",
      { complete: true, expectedRevision: 0 },
    );
    await db.userProfile.update({
      where: { userId },
      data: { recordingTimezone: "America/Los_Angeles" },
    });
    const result = await days.getDay(userId, "2026-09-27");
    expect(result.recorded).toBe(true);
    expect(result.timezone).toBe("Pacific/Auckland");
    expect(result.completedAt).toBe(now.toISOString());
  });
  it("counts only completed stored dates and exposes partial and unavailable coverage", async () => {
    const cycle = await db.trainingCycle.create({
      data: {
        userId,
        startDate: new Date("2026-09-20"),
        endDate: new Date("2026-09-27"),
        status: "CLOSED",
      },
    });
    for (const [status, coverage, kcal, date] of [
      ["COMPLETED", "COMPLETE", 300, "2026-09-27"],
      ["COMPLETED", "UNAVAILABLE", null, "2026-09-27"],
      ["PLANNED", "COMPLETE", 999, "2026-09-27"],
      ["COMPLETED", "UNAVAILABLE", null, "2026-09-28"],
    ] as const) {
      await db.scheduledWorkout.create({
        data: {
          userId,
          cycleId: cycle.id,
          activityType: "STRENGTH",
          scheduledDate: new Date("2026-09-20"),
          durationMinutes: 60,
          status,
          workoutLog: {
            create: {
              estimatedCaloriesKcal: kcal,
              energyCoverage: coverage,
              completedLocalDate: date,
              timezone: "Pacific/Auckland",
            },
          },
        },
      });
    }
    const result = await days.getDay(userId, "2026-09-27");
    expect(result.exercise).toMatchObject({
      estimatedKcal: 300,
      coverage: "PARTIAL",
    });
    expect(result.exercise.workouts).toHaveLength(2);
    expect(result.netKcal).toBe(-300);
    expect(result.completedAt).toBe(now.toISOString());
    expect((await days.getDay(userId, "2026-09-28")).exercise).toMatchObject({
      estimatedKcal: 0,
      coverage: "UNAVAILABLE",
    });
  });
});
