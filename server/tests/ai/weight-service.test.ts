import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../../src/db";
import { FakeAiClient } from "../../src/ai/fake-client";
import { WeightService } from "../../src/ai/weight-service";
import { seedSystemExercises } from "../../src/exercises/seed";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const integrationTestTimeout = 30_000;
const userId = `ai-weight-test-${randomUUID()}`;

describe.skipIf(!hasDatabase)("AI weight recommendations", () => {
  let cycleId: string;
  let nextWorkoutId: string;
  let laterWorkoutId: string;
  const exerciseId = "system-barbell-bench-press";

  beforeAll(async () => {
    await seedSystemExercises();
    await db.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        profile: {
          create: {
            primaryGoal: "FAT_LOSS",
            secondaryOutcome: "MUSCLE_PRESERVATION",
            weeklyTrainingDays: 3,
            sessionDurationMinutes: 60,
            defaultLocation: "GYM",
          },
        },
      },
    });

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

    for (let index = 0; index < 6; index += 1) {
      await db.scheduledWorkout.create({
        data: {
          userId,
          cycleId,
          activityType: "STRENGTH",
          scheduledDate: new Date(
            `2026-11-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
          ),
          location: "GYM",
          durationMinutes: 60,
          status: "COMPLETED",
          source: index === 5 ? "EXTRA" : "ORIGINAL",
          completedAt: new Date(
            `2026-11-${String(index + 1).padStart(2, "0")}T18:00:00Z`,
          ),
          workoutLog: {
            create: {
              exerciseLogs: {
                create: {
                  exerciseId,
                  sortOrder: 1,
                  setLogs: {
                    create: [
                      {
                        setNumber: 1,
                        actualReps: 8,
                        actualWeight: 50 + index,
                        weightUnit: "KG",
                      },
                      {
                        setNumber: 2,
                        actualReps: 8,
                        actualWeight: 50 + index,
                        weightUnit: "KG",
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      });
    }

    const nextWorkout = await db.scheduledWorkout.create({
      data: {
        userId,
        cycleId,
        activityType: "STRENGTH",
        scheduledDate: new Date("2026-11-10T00:00:00Z"),
        location: "GYM",
        durationMinutes: 60,
        status: "PLANNED",
        source: "ORIGINAL",
        plannedExercises: {
          create: {
            exerciseId,
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
    nextWorkoutId = nextWorkout.id;

    const laterWorkout = await db.scheduledWorkout.create({
      data: {
        userId,
        cycleId,
        activityType: "STRENGTH",
        scheduledDate: new Date("2026-11-17T00:00:00Z"),
        location: "GYM",
        durationMinutes: 60,
        status: "PLANNED",
        source: "ORIGINAL",
        plannedExercises: {
          create: {
            exerciseId,
            sortOrder: 1,
            restSeconds: 120,
            plannedSets: {
              create: [
                {
                  setNumber: 1,
                  targetReps: 8,
                  plannedWeight: 55,
                  weightUnit: "KG",
                },
              ],
            },
          },
        },
      },
    });
    laterWorkoutId = laterWorkout.id;
  }, integrationTestTimeout);

  afterAll(async () => {
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  }, integrationTestTimeout);

  it("uses bounded, labeled context and applies an accepted weight only to the next workout", async () => {
    const service = new WeightService(
      db,
      new FakeAiClient({
        recommendedWeight: 56,
        weightUnit: "KG",
        reason: "Recent completion is trending upward while the target stays at eight reps.",
        confidence: "medium",
      }),
    );

    const recommendation = await service.recommendNextWeight(
      userId,
      exerciseId,
      nextWorkoutId,
    );

    const historicalSetsBeforeDecision = await db.setLog.findMany({
      where: { exerciseLog: { workoutLog: { workout: { userId } } } },
      orderBy: { id: "asc" },
      select: { id: true, actualReps: true, actualWeight: true, weightUnit: true },
    });

    const context = recommendation.inputContext as {
      recentPerformance: Array<{ evidence: string }>;
      currentCycleSummary: unknown;
      allTimeBest: unknown;
      currentGoal: unknown;
      nextWorkoutTarget: unknown;
      cycleReviewPrompt?: unknown;
    };
    expect(context.recentPerformance).toHaveLength(5);
    expect(context.recentPerformance.some((record) => record.evidence === "PRIMARY")).toBe(true);
    expect(context.recentPerformance.some((record) => record.evidence === "SECONDARY")).toBe(true);
    expect(context.currentCycleSummary).toBeDefined();
    expect(context.allTimeBest).toBeDefined();
    expect(context.currentGoal).toEqual({
      primaryGoal: "FAT_LOSS",
      secondaryOutcome: "MUSCLE_PRESERVATION",
    });
    expect(context.nextWorkoutTarget).toMatchObject({
      exerciseId,
      sets: 2,
      targetReps: 8,
    });
    expect(context.cycleReviewPrompt).toBeUndefined();

    await service.applyWeightDecision(userId, recommendation.id, {
      action: "ACCEPT",
    });

    await expect(
      db.plannedSet.findMany({
        where: { plannedExercise: { workoutId: nextWorkoutId } },
        orderBy: { setNumber: "asc" },
      }),
    ).resolves.toEqual([
      expect.objectContaining({ plannedWeight: 56, weightUnit: "KG" }),
      expect.objectContaining({ plannedWeight: 56, weightUnit: "KG" }),
    ]);
    await expect(
      db.plannedSet.findMany({
        where: { plannedExercise: { workoutId: laterWorkoutId } },
      }),
    ).resolves.toEqual([
      expect.objectContaining({ plannedWeight: 55, weightUnit: "KG" }),
    ]);
    await expect(
      db.setLog.count({ where: { exerciseLog: { workoutLog: { workout: { userId } } } } }),
    ).resolves.toBe(12);
    await expect(
      db.setLog.findMany({
        where: { exerciseLog: { workoutLog: { workout: { userId } } } },
        orderBy: { id: "asc" },
        select: { id: true, actualReps: true, actualWeight: true, weightUnit: true },
      }),
    ).resolves.toEqual(historicalSetsBeforeDecision);
  }, integrationTestTimeout);

  it("applies a modified decision only to the next workout", async () => {
    const service = new WeightService(
      db,
      new FakeAiClient({
        recommendedWeight: 57,
        weightUnit: "KG",
        reason: "Test modification.",
        confidence: "medium",
      }),
    );
    const recommendation = await service.recommendNextWeight(
      userId,
      exerciseId,
      nextWorkoutId,
    );

    await service.applyWeightDecision(userId, recommendation.id, {
      action: "MODIFY",
      weight: 57.5,
      weightUnit: "KG",
    });

    await expect(
      db.plannedSet.findMany({
        where: { plannedExercise: { workoutId: nextWorkoutId } },
      }),
    ).resolves.toEqual([
      expect.objectContaining({ plannedWeight: 57.5, weightUnit: "KG" }),
      expect.objectContaining({ plannedWeight: 57.5, weightUnit: "KG" }),
    ]);
    await expect(
      db.plannedSet.findMany({
        where: { plannedExercise: { workoutId: laterWorkoutId } },
      }),
    ).resolves.toEqual([
      expect.objectContaining({ plannedWeight: 55, weightUnit: "KG" }),
    ]);
  }, integrationTestTimeout);

  it("rejects a recommendation without carrying a weight into a blank next workout", async () => {
    await db.plannedSet.updateMany({
      where: { plannedExercise: { workoutId: nextWorkoutId } },
      data: { plannedWeight: null, weightUnit: null },
    });

    const service = new WeightService(
      db,
      new FakeAiClient({
        recommendedWeight: 57,
        weightUnit: "KG",
        reason: "Test rejection.",
        confidence: "low",
      }),
    );

    const recommendation = await service.recommendNextWeight(
      userId,
      exerciseId,
      nextWorkoutId,
    );
    await service.applyWeightDecision(userId, recommendation.id, {
      action: "REJECT",
    });

    await expect(
      db.plannedSet.findMany({
        where: { plannedExercise: { workoutId: nextWorkoutId } },
      }),
    ).resolves.toEqual([
      expect.objectContaining({ plannedWeight: null, weightUnit: null }),
      expect.objectContaining({ plannedWeight: null, weightUnit: null }),
    ]);
  }, integrationTestTimeout);

  it("keeps an existing planned weight when the user rejects a recommendation", async () => {
    await db.plannedSet.updateMany({
      where: { plannedExercise: { workoutId: nextWorkoutId } },
      data: { plannedWeight: 54, weightUnit: "KG" },
    });

    const service = new WeightService(
      db,
      new FakeAiClient({
        recommendedWeight: 58,
        weightUnit: "KG",
        reason: "Test rejection with an existing plan.",
        confidence: "medium",
      }),
    );
    const recommendation = await service.recommendNextWeight(
      userId,
      exerciseId,
      nextWorkoutId,
    );
    await service.applyWeightDecision(userId, recommendation.id, {
      action: "REJECT",
    });

    await expect(
      db.plannedSet.findMany({
        where: { plannedExercise: { workoutId: nextWorkoutId } },
      }),
    ).resolves.toEqual([
      expect.objectContaining({ plannedWeight: 54, weightUnit: "KG" }),
      expect.objectContaining({ plannedWeight: 54, weightUnit: "KG" }),
    ]);
  }, integrationTestTimeout);

  it("rejects recommendations for a workout from an older cycle after a newer cycle exists", async () => {
    const newerCycle = await db.trainingCycle.create({
      data: {
        userId,
        startDate: new Date("2026-12-01T00:00:00Z"),
        endDate: new Date("2026-12-28T00:00:00Z"),
        timezone: "UTC",
        status: "DRAFT",
      },
    });

    const service = new WeightService(
      db,
      new FakeAiClient({
        recommendedWeight: 58,
        weightUnit: "KG",
        reason: "Should not be requested for an old cycle.",
        confidence: "low",
      }),
    );

    await expect(
      service.recommendNextWeight(userId, exerciseId, nextWorkoutId),
    ).rejects.toThrow(/newer cycle|read-only/i);

    await db.trainingCycle.delete({ where: { id: newerCycle.id } });
  }, integrationTestTimeout);
});
