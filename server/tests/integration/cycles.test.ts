import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CycleService } from "../../src/cycles/service";
import { db } from "../../src/db";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const now = new Date("2026-10-07T12:00:00Z");
const userId = `cycle-test-${randomUUID()}`;
const lifecycleUserId = `cycle-lifecycle-test-${randomUUID()}`;

describe.skipIf(!hasDatabase)("cycle persistence", () => {
  const service = new CycleService(db);

  beforeAll(async () => {
    await Promise.all(
      [userId, lifecycleUserId].map((id) =>
        db.user.create({
          data: {
            id,
            email: `${id}@example.com`,
            profile: {
              create: {
                primaryGoal: "FAT_LOSS",
                weeklyTrainingDays: 3,
                sessionDurationMinutes: 60,
                defaultLocation: "GYM",
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

  it("creates a four-week draft with deterministic first-week dates", async () => {
    const draft = await service.createDraft(
      userId,
      {
        weeklyTrainingDays: 3,
        sessionDurationMinutes: 60,
        defaultLocation: "GYM",
      },
      now,
    );

    expect(draft.status).toBe("DRAFT");
    expect(draft.endDate).toEqual(new Date("2026-11-03T00:00:00Z"));
    expect(draft.firstWeekDates.map((date) => date.toISOString().slice(0, 10))).toEqual([
      "2026-10-07",
      "2026-10-10",
      "2026-10-13",
    ]);
  });

  it("closes, auto-cancels, and restores a workout before the next cycle exists", async () => {
    const cycle = await db.trainingCycle.create({
      data: {
        userId: lifecycleUserId,
        startDate: new Date("2026-09-09T00:00:00Z"),
        endDate: new Date("2026-10-06T00:00:00Z"),
        status: "ACTIVE",
        workouts: {
          create: [
            {
              userId: lifecycleUserId,
              activityType: "STRENGTH",
              scheduledDate: new Date("2026-10-05T00:00:00Z"),
              location: "GYM",
              durationMinutes: 60,
              status: "PLANNED",
            },
            {
              userId: lifecycleUserId,
              activityType: "CARDIO",
              scheduledDate: new Date("2026-10-06T00:00:00Z"),
              location: "GYM",
              durationMinutes: 30,
              status: "COMPLETED",
              completedAt: new Date("2026-10-06T10:00:00Z"),
            },
          ],
        },
      },
      include: { workouts: true },
    });

    const closed = await service.close(lifecycleUserId, cycle.id, now);
    expect(closed.cycleStatus).toBe("CLOSED");
    expect(closed.cancelledWorkoutIds).toHaveLength(1);

    const plannedWorkout = cycle.workouts.find(
      (workout) => workout.status === "PLANNED",
    );
    if (!plannedWorkout) {
      throw new Error("Test fixture did not create a planned workout");
    }

    const persistedCancellation = await db.scheduledWorkout.findUnique({
      where: { id: plannedWorkout.id },
      select: { status: true, cancellationReason: true },
    });
    expect(persistedCancellation).toEqual({
      status: "CANCELLED",
      cancellationReason: "AUTO_CYCLE_CLOSE",
    });

    const restored = await service.restoreAutoCancelledWorkout(
      lifecycleUserId,
      cycle.id,
      plannedWorkout.id,
      new Date("2026-10-08T00:00:00Z"),
    );

    expect(restored.status).toBe("PLANNED");
    expect(restored.scheduledDate).toEqual(new Date("2026-10-08T00:00:00Z"));
  });
});
