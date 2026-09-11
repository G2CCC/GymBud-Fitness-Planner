import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedSystemExercises } from "../../src/exercises/seed";
import { db } from "../../src/db";
import { WorkoutService } from "../../src/workouts/service";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const integrationTestTimeout = 30_000;
const userId = `workout-test-${randomUUID()}`;
const otherUserId = `workout-other-test-${randomUUID()}`;

describe.skipIf(!hasDatabase)("workout persistence", () => {
  const service = new WorkoutService(db);
  let cycleId: string;
  let strengthWorkoutId: string;

  beforeAll(async () => {
    await seedSystemExercises();
    await Promise.all(
      [userId, otherUserId].map((id) =>
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

    const cycle = await db.trainingCycle.create({
      data: {
        userId,
        startDate: new Date("2026-11-01T00:00:00Z"),
        endDate: new Date("2026-11-28T00:00:00Z"),
        timezone: "UTC",
        status: "ACTIVE",
      },
    });
    cycleId = cycle.id;

    const workout = await db.scheduledWorkout.create({
      data: {
        userId,
        cycleId,
        activityType: "STRENGTH",
        scheduledDate: new Date("2026-11-03T00:00:00Z"),
        location: "GYM",
        durationMinutes: 60,
        plannedExercises: {
          create: {
            exerciseId: "system-push-up",
            sortOrder: 1,
            restSeconds: 90,
            plannedSets: {
              create: [
                { setNumber: 1, targetReps: 10 },
                { setNumber: 2, targetReps: 10 },
              ],
            },
          },
        },
      },
    });
    strengthWorkoutId = workout.id;
  }, integrationTestTimeout);

  afterAll(async () => {
    await Promise.all(
      [userId, otherUserId].map((id) =>
        db.user.delete({ where: { id } }),
      ),
    );
    await db.$disconnect();
  }, integrationTestTimeout);

  it("completes a workout and preserves the explicit completion time", async () => {
    const completedAt = new Date("2026-11-03T18:30:00Z");
    const completed = await service.completeWorkout(
      userId,
      strengthWorkoutId,
      { completedAt },
      new Date("2026-11-04T12:00:00Z"),
    );

    expect(completed.status).toBe("COMPLETED");
    expect(completed.completedAt).toEqual(completedAt);
  }, integrationTestTimeout);

  it("can complete a workout and save its log in one transaction", async () => {
    const workout = await db.scheduledWorkout.create({
      data: {
        userId,
        cycleId,
        activityType: "STRENGTH",
        scheduledDate: new Date("2026-11-04T00:00:00Z"),
        location: "GYM",
        durationMinutes: 45,
      },
    });

    const completed = await service.completeWorkout(
      userId,
      workout.id,
      {
        completedAt: new Date("2026-11-04T10:00:00Z"),
        log: {
          exercises: [
            {
              exerciseId: "system-push-up",
              sortOrder: 1,
              sets: [{ setNumber: 1, reps: 12 }],
            },
          ],
        },
      },
      new Date("2026-11-04T12:00:00Z"),
    );

    expect(completed.status).toBe("COMPLETED");
    await expect(
      db.workoutLog.findUnique({ where: { workoutId: workout.id } }),
    ).resolves.toEqual(expect.objectContaining({ workoutId: workout.id }));
  }, integrationTestTimeout);

  it("upserts one strength log instead of creating duplicate logs", async () => {
    const first = await service.saveWorkoutLog(userId, strengthWorkoutId, {
      exercises: [
        {
          exerciseId: "system-push-up",
          sortOrder: 1,
          sets: [
            { setNumber: 1, reps: 10, weight: 0, weightUnit: "KG" },
          ],
        },
      ],
    });
    const second = await service.saveWorkoutLog(userId, strengthWorkoutId, {
      exercises: [
        {
          exerciseId: "system-push-up",
          sortOrder: 1,
          sets: [
            { setNumber: 1, reps: 8, weight: 0, weightUnit: "KG" },
            { setNumber: 2, reps: 8, weight: 0, weightUnit: "KG" },
          ],
        },
      ],
    });

    const persisted = await db.workoutLog.findUnique({
      where: { workoutId: strengthWorkoutId },
      include: { exerciseLogs: { include: { setLogs: true } } },
    });

    expect(second.id).toBe(first.id);
    expect(persisted?.exerciseLogs).toHaveLength(1);
    expect(persisted?.exerciseLogs[0]?.setLogs).toHaveLength(2);
    expect(persisted?.exerciseLogs[0]?.setLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ setNumber: 1, actualReps: 8 }),
      ]),
    );
  }, integrationTestTimeout);

  it("creates an extra workout in the active cycle", async () => {
    const extra = await service.createExtraWorkout(userId, {
      activityType: "CARDIO",
      scheduledDate: new Date("2026-11-06T00:00:00Z"),
      location: "HOME",
      durationMinutes: 30,
    });

    expect(extra).toMatchObject({
      cycleId,
      userId,
      source: "EXTRA",
      status: "PLANNED",
    });
  }, integrationTestTimeout);

  it("reschedules, changes location, and cancels a planned workout", async () => {
    const workout = await db.scheduledWorkout.create({
      data: {
        userId,
        cycleId,
        activityType: "CARDIO",
        scheduledDate: new Date("2026-11-07T00:00:00Z"),
        location: "GYM",
        durationMinutes: 30,
      },
    });

    const rescheduled = await service.rescheduleWorkout(
      userId,
      workout.id,
      new Date("2026-11-08T00:00:00Z"),
    );
    expect(rescheduled.scheduledDate).toEqual(
      new Date("2026-11-08T00:00:00Z"),
    );

    const moved = await service.updateWorkoutLocation(
      userId,
      workout.id,
      "HOME",
    );
    expect(moved.location).toBe("HOME");

    const cancelled = await service.cancelWorkout(userId, workout.id);
    expect(cancelled).toMatchObject({
      status: "CANCELLED",
      cancellationReason: "USER",
    });
  }, integrationTestTimeout);

  it("rejects an RPE field and prevents another user from reading the workout", async () => {
    await expect(
      service.saveWorkoutLog(userId, strengthWorkoutId, {
        exercises: [
          {
            exerciseId: "system-push-up",
            sortOrder: 1,
            sets: [{ setNumber: 1, reps: 8, rpe: 7 }],
          },
        ],
      } as never),
    ).rejects.toThrow();

    await expect(
      service.completeWorkout(
        otherUserId,
        strengthWorkoutId,
        {},
        new Date("2026-11-04T12:00:00Z"),
      ),
    ).rejects.toThrow(/not found/);
  }, integrationTestTimeout);

  it("rejects log writes after the cycle is closed", async () => {
    await db.trainingCycle.update({
      where: { id: cycleId },
      data: { status: "CLOSED", closedAt: new Date("2026-11-29T00:00:00Z") },
    });

    await expect(
      service.saveWorkoutLog(userId, strengthWorkoutId, {
        exercises: [
          {
            exerciseId: "system-push-up",
            sortOrder: 1,
            sets: [{ setNumber: 1, reps: 8 }],
          },
        ],
      }),
    ).rejects.toThrow(/cycle/);
  }, integrationTestTimeout);
});
