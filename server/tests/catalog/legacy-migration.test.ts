import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../../src/db";
import { migrateLegacySystemExercises } from "../../src/catalog/legacy-migration";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const userId = `legacy-migration-${randomUUID()}`;
const legacyId = "system-push-up";
const canonicalId = "free-exercise-db-Pushups";

describe.skipIf(!hasDatabase)("legacy exercise migration", () => {
  beforeAll(async () => {
    await db.exercise.upsert({
      where: { id: legacyId },
      update: { ownerId: null },
      create: {
        id: legacyId,
        name: "Push-up",
        equipment: "NONE",
        targetMuscles: ["CHEST"],
        aiEligible: true,
      },
    });
    await db.exercise.upsert({
      where: { id: canonicalId },
      update: { ownerId: null },
      create: {
        id: canonicalId,
        name: "Pushups",
        equipment: "NONE",
        targetMuscles: ["CHEST"],
        sourceProvider: "free-exercise-db",
        sourceId: "Pushups",
        aiEligible: true,
      },
    });
    await db.user.create({ data: { id: userId, email: `${userId}@example.test` } });
    const cycle = await db.trainingCycle.create({
      data: {
        userId,
        startDate: new Date("2026-09-21T00:00:00Z"),
        endDate: new Date("2026-09-27T00:00:00Z"),
        status: "ACTIVE",
      },
    });
    const workout = await db.scheduledWorkout.create({
      data: {
        userId,
        cycleId: cycle.id,
        activityType: "STRENGTH",
        scheduledDate: new Date("2026-09-25T00:00:00Z"),
        durationMinutes: 45,
        plannedExercises: {
          create: {
            exerciseId: legacyId,
            sortOrder: 1,
            plannedSets: { create: [{ setNumber: 1, targetReps: 10 }] },
          },
        },
      },
    });
    const log = await db.workoutLog.create({
      data: {
        workoutId: workout.id,
        exerciseLogs: {
          create: {
            exerciseId: legacyId,
            sortOrder: 1,
            setLogs: {
              create: [{ setNumber: 1, actualReps: 10, actualWeight: 0, weightUnit: "KG" }],
            },
          },
        },
      },
    });
    await db.aiRecommendation.create({
      data: {
        userId,
        workoutId: workout.id,
        exerciseId: legacyId,
        kind: "WEIGHT",
        reason: "Keep the movement consistent",
        status: "APPLIED",
      },
    });
    expect(log.id).toBeTruthy();
  }, 30_000);

  afterAll(async () => {
    await db.user.delete({ where: { id: userId } });
    await db.exercise.deleteMany({ where: { id: { in: [legacyId, canonicalId] } } });
    await db.$disconnect();
  }, 30_000);

  it("remaps all references without losing set history", async () => {
    const originalSetCount = await db.setLog.count();
    const result = await migrateLegacySystemExercises(db);

    expect(result.deletedExercises).toBe(1);
    expect(result.migratedReferences).toBe(3);
    expect(await db.plannedExercise.findFirstOrThrow()).toMatchObject({ exerciseId: canonicalId });
    expect(await db.exerciseLog.findFirstOrThrow()).toMatchObject({ exerciseId: canonicalId });
    expect(await db.aiRecommendation.findFirstOrThrow()).toMatchObject({ exerciseId: canonicalId });
    expect(await db.setLog.count()).toBe(originalSetCount);
    expect(await db.exercise.count({ where: { id: legacyId } })).toBe(0);
  });

  it("does not delete a user-owned exercise", async () => {
    const customId = `custom-legacy-name-${randomUUID()}`;
    await db.exercise.create({
      data: {
        id: customId,
        ownerId: userId,
        name: "Push-up",
        targetMuscles: ["CHEST"],
      },
    });

    await migrateLegacySystemExercises(db);
    await expect(db.exercise.findUnique({ where: { id: customId } })).resolves.toMatchObject({
      id: customId,
      ownerId: userId,
    });
  });
});
