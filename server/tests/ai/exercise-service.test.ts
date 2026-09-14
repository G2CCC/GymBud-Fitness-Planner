import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../../src/db";
import { FakeAiClient } from "../../src/ai/fake-client";
import { AiExerciseService } from "../../src/ai/exercise-service";
import { ExerciseService } from "../../src/exercises/service";
import { seedSystemExercises } from "../../src/exercises/seed";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const integrationTestTimeout = 30_000;
const userId = `ai-exercise-test-${randomUUID()}`;

describe.skipIf(!hasDatabase)("AI exercise workflows", () => {
  let activeCycleId: string;
  let incompatibleWorkoutId: string;

  beforeAll(async () => {
    await seedSystemExercises();
    await db.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        profile: {
          create: {
            primaryGoal: "FAT_LOSS",
            weeklyTrainingDays: 3,
            sessionDurationMinutes: 45,
            defaultLocation: "HOME",
          },
        },
      },
    });

    const cycle = await db.trainingCycle.create({
      data: {
        userId,
        startDate: new Date("2026-12-01T00:00:00Z"),
        endDate: new Date("2026-12-28T00:00:00Z"),
        timezone: "UTC",
        status: "ACTIVE",
      },
    });
    activeCycleId = cycle.id;

    const workout = await db.scheduledWorkout.create({
      data: {
        userId,
        cycleId: activeCycleId,
        activityType: "STRENGTH",
        scheduledDate: new Date("2026-12-03T00:00:00Z"),
        location: "HOME",
        durationMinutes: 45,
        status: "PLANNED",
        source: "ORIGINAL",
        plannedExercises: {
          create: {
            exerciseId: "system-barbell-bench-press",
            sortOrder: 1,
            restSeconds: 120,
            plannedSets: {
              create: [
                { setNumber: 1, targetReps: 8 },
                { setNumber: 2, targetReps: 8 },
              ],
            },
          },
        },
      },
    });
    incompatibleWorkoutId = workout.id;
  }, integrationTestTimeout);

  afterAll(async () => {
    await db.exercise.deleteMany({ where: { ownerId: userId } });
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  }, integrationTestTimeout);

  it("rejects equipment metadata tagged for HOME and does not persist it", async () => {
    const service = new AiExerciseService(
      db,
      new FakeAiClient({
        name: "Home Barbell Press",
        description: "A barbell press.",
        equipment: "BARBELL",
        targetMuscles: ["CHEST"],
        movementPattern: "PUSH",
        availableLocations: ["HOME"],
      }),
    );

    await expect(
      service.extractExerciseMetadata({
        name: "Home Barbell Press",
        description: "A barbell press.",
      }),
    ).rejects.toThrow(/equipment|GYM|location/i);

    await expect(
      db.exercise.count({ where: { ownerId: userId } }),
    ).resolves.toBe(0);
  }, integrationTestTimeout);

  it("keeps an extracted but unconfirmed exercise out of the AI pool", async () => {
    const aiService = new AiExerciseService(
      db,
      new FakeAiClient({
        name: "Home Reverse Lunge",
        description: "A bodyweight unilateral leg exercise.",
        equipment: "NONE",
        targetMuscles: ["GLUTES", "QUADRICEPS"],
        movementPattern: "LUNGE",
        availableLocations: ["GYM", "HOME"],
      }),
    );

    const draft = await aiService.extractExerciseMetadata({
      name: "Home Reverse Lunge",
      description: "A bodyweight unilateral leg exercise.",
    });

    expect(draft.name).toBe("Home Reverse Lunge");
    const exerciseService = new ExerciseService(db);
    await expect(
      exerciseService.listAvailableExercises(userId, "HOME", {
        aiEligibleOnly: true,
      }),
    ).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: draft.name })]),
    );

    await exerciseService.createConfirmedCustomExercise(userId, draft);
    await expect(
      exerciseService.listAvailableExercises(userId, "HOME", {
        aiEligibleOnly: true,
      }),
    ).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: draft.name })]),
    );
  }, integrationTestTimeout);

  it("returns only AI-proposed replacements that are legal for the workout location", async () => {
    const service = new AiExerciseService(
      db,
      new FakeAiClient({
        replacements: [
          {
            exerciseId: "system-push-up",
            reason: "It is a bodyweight push and works at home.",
            restSeconds: 60,
            sets: [{ setNumber: 1, targetReps: 10 }],
          },
        ],
      }),
    );

    const replacements = await service.getCompatibleReplacements(
      userId,
      incompatibleWorkoutId,
      "system-barbell-bench-press",
    );

    expect(replacements).toEqual([
      expect.objectContaining({
        exerciseId: "system-push-up",
        availableLocations: ["GYM", "HOME"],
      }),
    ]);
  }, integrationTestTimeout);

  it("rejects a replacement ID that is outside the server-provided legal pool", async () => {
    const service = new AiExerciseService(
      db,
      new FakeAiClient({
        replacements: [
          {
            exerciseId: "system-barbell-back-squat",
            reason: "The model selected this gym exercise.",
            sets: [{ setNumber: 1, targetReps: 8 }],
          },
        ],
      }),
    );

    await expect(
      service.getCompatibleReplacements(
        userId,
        incompatibleWorkoutId,
        "system-barbell-bench-press",
      ),
    ).rejects.toThrow(/not legal|replacement/i);
  }, integrationTestTimeout);
});
