import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CycleService } from "../../src/cycles/service";
import { seedCatalog } from "../../src/catalog/seed";
import { db } from "../../src/db";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const now = new Date("2026-10-07T12:00:00Z");
const userId = `cycle-test-${randomUUID()}`;
const lifecycleUserId = `cycle-lifecycle-test-${randomUUID()}`;

describe.skipIf(!hasDatabase)("cycle persistence", () => {
  const service = new CycleService(db);

  beforeAll(async () => {
    await seedCatalog(db);
    await Promise.all(
      [userId, lifecycleUserId].map((id) =>
        db.user.create({
          data: {
            id,
            email: `${id}@example.com`,
            profile: {
              create: {
                primaryGoal: "FAT_LOSS",
                gender: "MALE",
                age: 30,
                heightCm: 180,
                weightKg: 80,
                weeklyTrainingDays: 3,
                sessionDurationMinutes: 60,
              },
            },
          },
        }),
      ),
    );
  });

  afterAll(async () => {
    await Promise.all(
      [userId, lifecycleUserId].map((id) =>
        db.user.delete({ where: { id } }),
      ),
    );
    await db.$disconnect();
  });

  it("creates a seven-day draft with deterministic training dates", async () => {
    const draft = await service.createDraft(
      userId,
      {
        weeklyTrainingDays: 3,
        sessionDurationMinutes: 60,
        timezone: "Pacific/Auckland",
      },
      now,
    );

    expect(draft.status).toBe("DRAFT");
    expect(draft.endDate).toEqual(new Date("2026-10-14T00:00:00Z"));
    expect(draft.firstWeekDates.map((date) => date.toISOString().slice(0, 10))).toEqual([
      "2026-10-08",
      "2026-10-11",
      "2026-10-14",
    ]);

    const active = await service.activateDraft(
      userId,
      draft.id,
      "Pacific/Auckland",
      now,
    );

    expect(active.status).toBe("ACTIVE");
    expect(active.cycleNumber).toBe(1);
    expect(active.timezone).toBe("Pacific/Auckland");
    expect(active.startDate).toEqual(new Date("2026-10-08T00:00:00Z"));
    expect(active.endDate).toEqual(new Date("2026-10-14T00:00:00Z"));
  });

  it("requires planned workouts to be completed or deleted before closing", async () => {
    const cycle = await db.trainingCycle.create({
      data: {
        userId: lifecycleUserId,
        cycleNumber: 1,
        startDate: new Date("2026-09-09T00:00:00Z"),
        endDate: new Date("2026-10-06T00:00:00Z"),
        timezone: "UTC",
        status: "ACTIVE",
        workouts: {
          create: [
            {
              userId: lifecycleUserId,
              activityType: "STRENGTH",
              scheduledDate: new Date("2026-10-05T00:00:00Z"),
              durationMinutes: 60,
              status: "PLANNED",
            },
            {
              userId: lifecycleUserId,
              activityType: "CARDIO",
              activityOptionId: "cardio-treadmill-running",
              scheduledDate: new Date("2026-10-06T00:00:00Z"),
              durationMinutes: 30,
              status: "COMPLETED",
              completedAt: new Date("2026-10-06T10:00:00Z"),
            },
            {
              userId: lifecycleUserId,
              activityType: "SPORT",
              activityOptionId: "sport-basketball",
              scheduledDate: new Date("2026-10-04T00:00:00Z"),
              durationMinutes: 45,
              status: "PLANNED",
            },
          ],
        },
      },
      include: { workouts: true },
    });

    const finalDayReview = await service.getReviewStatus(
      lifecycleUserId,
      cycle.id,
      new Date("2026-10-06T12:00:00Z"),
    );
    expect(finalDayReview).toMatchObject({
      reviewRequired: false,
      reviewAvailable: false,
      blockedReason: "PLANNED_WORKOUTS_REMAINING",
      plannedWorkoutCount: 2,
    });

    const overdueReview = await service.getReviewStatus(
      lifecycleUserId,
      cycle.id,
      now,
    );
    expect(overdueReview).toMatchObject({
      reviewRequired: false,
      reviewAvailable: false,
      blockedReason: "PLANNED_WORKOUTS_REMAINING",
      plannedWorkoutCount: 2,
    });

    const stillActive = await db.trainingCycle.findUnique({
      where: { id: cycle.id },
      select: { status: true },
    });
    expect(stillActive?.status).toBe("ACTIVE");

    await expect(service.close(lifecycleUserId, cycle.id, now)).rejects.toThrow(
      /complete or delete/i,
    );

    const plannedWorkouts = cycle.workouts.filter(
      (workout) => workout.status === "PLANNED",
    );
    await db.scheduledWorkout.deleteMany({
      where: { id: { in: plannedWorkouts.map((workout) => workout.id) } },
    });

    const availableReview = await service.getReviewStatus(
      lifecycleUserId,
      cycle.id,
      now,
    );
    expect(availableReview).toMatchObject({
      reviewRequired: true,
      reviewAvailable: true,
      blockedReason: null,
      plannedWorkoutCount: 0,
    });

    const closed = await service.close(lifecycleUserId, cycle.id, now);
    expect(closed.cycleStatus).toBe("CLOSED");
    expect(closed.unresolvedWorkoutIds).toEqual([]);
    expect(closed.nextCycleEligibility).toBe("ELIGIBLE");

    const completedWorkout = cycle.workouts.find(
      (workout) => workout.status === "COMPLETED",
    );
    if (!completedWorkout) {
      throw new Error("Test fixture did not create a completed workout");
    }

    await expect(
      db.scheduledWorkout.findUnique({
        where: { id: completedWorkout.id },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "COMPLETED" });
  });
});
