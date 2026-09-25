import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { calendarDateRangeToUtcBounds, calendarRangeQuerySchema } from "@fitness/shared";
import { CalendarService } from "../../src/calendar/service";
import { seedCatalog } from "../../src/catalog/seed";
import { db } from "../../src/db";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const userId = `calendar-test-${randomUUID()}`;
const otherUserId = `calendar-other-test-${randomUUID()}`;

describe.skipIf(!hasDatabase)("calendar persistence", () => {
  const service = new CalendarService(db);
  let userCycleId: string;
  let otherCycleId: string;

  beforeAll(async () => {
    await seedCatalog(db);
    await Promise.all(
      [
        [userId, "calendar@example.com"],
        [otherUserId, "calendar-other@example.com"],
      ].map(([id, email]) =>
        db.user.create({
          data: {
            id,
            email,
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

    const [userCycle, otherCycle] = await Promise.all([
      db.trainingCycle.create({
        data: {
          userId,
          startDate: new Date("2026-09-01T00:00:00.000Z"),
          endDate: new Date("2026-09-30T00:00:00.000Z"),
          timezone: "UTC",
          cycleNumber: 1,
          status: "ACTIVE",
        },
      }),
      db.trainingCycle.create({
        data: {
          userId: otherUserId,
          startDate: new Date("2026-09-01T00:00:00.000Z"),
          endDate: new Date("2026-09-30T00:00:00.000Z"),
          timezone: "UTC",
          cycleNumber: 1,
          status: "ACTIVE",
        },
      }),
    ]);

    userCycleId = userCycle.id;
    otherCycleId = otherCycle.id;

    await db.scheduledWorkout.createMany({
      data: [
        {
          userId,
          cycleId: userCycleId,
          activityType: "STRENGTH",
          scheduledDate: new Date("2026-09-01T00:00:00.000Z"),
          durationMinutes: 60,
          status: "COMPLETED",
          completedAt: new Date("2026-09-01T10:00:00.000Z"),
        },
        {
          userId,
          cycleId: userCycleId,
          activityType: "CARDIO",
          activityOptionId: "cardio-treadmill-running",
          scheduledDate: new Date("2026-09-15T00:00:00.000Z"),
          durationMinutes: 30,
          status: "PLANNED",
        },
        {
          userId,
          cycleId: userCycleId,
          activityType: "SPORT",
          activityOptionId: "sport-basketball",
          scheduledDate: new Date("2026-10-01T00:00:00.000Z"),
          durationMinutes: 45,
          status: "PLANNED",
        },
        {
          userId: otherUserId,
          cycleId: otherCycleId,
          activityType: "STRENGTH",
          scheduledDate: new Date("2026-09-15T00:00:00.000Z"),
          durationMinutes: 60,
          status: "PLANNED",
        },
      ],
    });
  });

  afterAll(async () => {
    await Promise.all([
      db.user.delete({ where: { id: userId } }),
      db.user.delete({ where: { id: otherUserId } }),
    ]);
    await db.$disconnect();
  });

  it("returns both inclusive boundaries and all statuses only for the requested user", async () => {
    const range = calendarDateRangeToUtcBounds(
      calendarRangeQuerySchema.parse({ from: "2026-09-01", to: "2026-09-30" }),
    );

    const workouts = await service.listWorkouts(userId, range);

    expect(workouts.map((workout) => workout.scheduledDate.toISOString())).toEqual([
      "2026-09-01T00:00:00.000Z",
      "2026-09-30T00:00:00.000Z",
    ]);
    expect(workouts.map((workout) => workout.status)).toEqual([
      "COMPLETED",
      "PLANNED",
    ]);
  });
});
