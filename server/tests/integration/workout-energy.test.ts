import "dotenv/config";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { db } from "../../src/db";
import { seedCatalog } from "../../src/catalog/seed";
import { ProfileService } from "../../src/profiles/service";
import { WorkoutService } from "../../src/workouts/service";
describe.skipIf(!process.env.DATABASE_URL)("workout energy snapshots", () => {
  const userId = randomUUID(),
    service = new WorkoutService(db);
  let cycleId: string;
  const now = new Date("2026-10-02T12:00:00Z");
  const strength = {
    exercises: [
      {
        exerciseId: "free-exercise-db-Pushups",
        sortOrder: 1,
        sets: [
          { setNumber: 1, reps: 10, weight: 0, weightUnit: "KG" as const },
          { setNumber: 2, reps: 0, weight: 0, weightUnit: "KG" as const },
        ],
      },
    ],
  };
  async function workout(activityType: "STRENGTH" | "CARDIO" | "SPORT") {
    return db.scheduledWorkout.create({
      data: {
        userId,
        cycleId,
        activityType,
        scheduledDate: new Date("2026-10-01"),
        durationMinutes: 45,
        ...(activityType === "STRENGTH"
          ? {
              plannedExercises: {
                create: {
                  exerciseId: "free-exercise-db-Pushups",
                  sortOrder: 1,
                  restSeconds: 0,
                },
              },
            }
          : {
              activityOptionId:
                activityType === "CARDIO"
                  ? "cardio-treadmill-running"
                  : "sport-basketball",
            }),
      },
    });
  }
  beforeAll(async () => {
    await seedCatalog(db);
    await db.user.create({
      data: { id: userId, email: `${userId}@energy.test` },
    });
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
      new Date("2026-09-01"),
    );
    cycleId = (
      await db.trainingCycle.create({
        data: {
          userId,
          startDate: new Date("2026-09-25"),
          endDate: new Date("2026-10-02"),
          status: "ACTIVE",
        },
      })
    ).id;
  });
  afterAll(async () => {
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });
  it.each(["STRENGTH", "CARDIO", "SPORT"] as const)(
    "rejects %s completion without a valid log atomically",
    async (type) => {
      const w = await workout(type);
      await expect(
        service.completeWorkout(userId, w.id, {}, now),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(
        (await db.scheduledWorkout.findUniqueOrThrow({ where: { id: w.id } }))
          .status,
      ).toBe("PLANNED");
      expect(await db.workoutLog.count({ where: { workoutId: w.id } })).toBe(0);
    },
  );
  it("uses actual nonzero sets, saves draft energy without completion, and keeps original body weight on edits", async () => {
    const w = await workout("STRENGTH");
    await service.saveWorkoutLog(userId, w.id, strength);
    const draft = await db.workoutLog.findUniqueOrThrow({
      where: { workoutId: w.id },
    });
    expect(draft.estimatedCaloriesKcal).toBe(2);
    expect(draft.completedLocalDate).toBeNull();
    await service.completeWorkout(
      userId,
      w.id,
      { completedAt: new Date("2026-09-27T10:00:00Z") },
      now,
    );
    await db.userProfile.update({
      where: { userId },
      data: { weightKg: 120, recordingTimezone: "America/Los_Angeles" },
    });
    await service.saveWorkoutLog(userId, w.id, strength);
    const saved = await db.workoutLog.findUniqueOrThrow({
      where: { workoutId: w.id },
    });
    expect(saved.estimatedCaloriesKcal).toBe(2);
    expect(saved.energyInputs).toMatchObject({ bodyWeightKg: 80 });
    expect(saved.completedLocalDate).toBe("2026-09-27");
    expect(saved.timezone).toBe("Pacific/Auckland");
    expect(await db.workoutLog.count({ where: { workoutId: w.id } })).toBe(1);
  });
  it("backfills actual duration and pins completion date; rejects inconsistent existing-day timezone", async () => {
    await db.userProfile.update({
      where: { userId },
      data: { weightKg: 80, recordingTimezone: "Pacific/Auckland" },
    });
    const w = await workout("CARDIO");
    await expect(
      service.backfillWorkout(
        userId,
        w.id,
        { completedAt: "2026-09-28T12:00:00Z", log: { distanceKm: 4 } },
        now,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    await service.backfillWorkout(
      userId,
      w.id,
      {
        completedAt: "2026-09-28T12:00:00Z",
        log: { actualDurationMinutes: 30 },
      },
      now,
    );
    const saved = await db.workoutLog.findUniqueOrThrow({
      where: { workoutId: w.id },
    });
    expect(saved.completedLocalDate).toBe("2026-09-29");
    expect(saved.estimatedCaloriesKcal).toBe(300);
    await db.nutritionDay.create({
      data: {
        userId,
        localDate: "2026-09-30",
        timezone: "America/Los_Angeles",
      },
    });
    await expect(
      service.completeWorkout(
        userId,
        w.id,
        { completedAt: new Date("2026-09-29T12:00:00Z") },
        now,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(
      (await db.workoutLog.findUniqueOrThrow({ where: { workoutId: w.id } }))
        .completedLocalDate,
    ).toBe("2026-09-29");
  });
});
