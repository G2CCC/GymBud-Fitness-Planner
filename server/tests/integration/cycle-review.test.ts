import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/db";
import { FakeAiClient } from "../../src/ai/fake-client";
import { PlanService } from "../../src/ai/plan-service";
import { CycleService } from "../../src/cycles/service";
import { CycleReviewService } from "../../src/reviews/service";
import { seedSystemExercises } from "../../src/exercises/seed";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const integrationTestTimeout = 30_000;
const userId = `cycle-review-test-${randomUUID()}`;

const reviewResponse = {
  processedSummary: "The recorded training volume was consistent enough to continue.",
  conclusions: {
    status: "CONTINUE",
    keyFindings: ["The user recorded actual training volume."],
    recommendations: ["Keep the next plan manageable."],
  },
} as const;

const nextPlanResponse = {
  workouts: [
    {
      scheduledDate: "2026-12-01T00:00:00Z",
      activityType: "STRENGTH",
      location: "GYM",
      durationMinutes: 60,
      exercises: [
        {
          exerciseId: "system-push-up",
          sortOrder: 1,
          restSeconds: 60,
          sets: [{ setNumber: 1, targetReps: 10 }],
        },
      ],
    },
  ],
} as const;

describe.skipIf(!hasDatabase)("cycle volume review persistence", () => {
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
  }, integrationTestTimeout);

  beforeEach(async () => {
    await db.cycleBatchReview.deleteMany({ where: { userId } });
    await db.trainingCycle.deleteMany({ where: { userId } });
  });

  afterAll(async () => {
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  }, integrationTestTimeout);

  it("persists one current-cycle volume review and never creates a next plan", async () => {
    const cycle = await createCycle({ cycleNumber: 1, status: "ACTIVE" });
    const rawSummary = "private note that must not be stored";
    const ai = new FakeAiClient(reviewResponse);
    const service = new CycleReviewService(
      db,
      ai,
      new CycleService(db),
      new PlanService(db, ai, "test-model"),
      "test-model",
    );

    const result = await service.generateCycleReview(
      userId,
      cycle.id,
      rawSummary,
      new Date("2026-10-01T12:00:00Z"),
    );

    expect(result.trainingVolume.completedWorkoutCount).toBe(1);
    expect(result.batchReview.eligible).toBe(false);
    expect(result.nextCycleDraftStatus).toBe("NOT_AVAILABLE");
    expect(ai.requests[0]?.userPrompt).toContain("trainingVolume");
    expect(ai.requests[0]?.userPrompt).toContain(rawSummary);

    const snapshot = await db.cycleReviewSnapshot.findUniqueOrThrow({
      where: { cycleId: cycle.id },
    });
    expect(snapshot.processedSummary).toBe(reviewResponse.processedSummary);
    expect(JSON.stringify(snapshot)).not.toContain(rawSummary);
    expect(snapshot.nextCycleDraft).toEqual({ status: "NOT_AVAILABLE" });
    expect(
      await db.trainingCycle.findUnique({
        where: { id: cycle.id },
        select: { status: true },
      }),
    ).toEqual({ status: "CLOSED" });
    expect(
      await db.trainingCycle.count({ where: { userId, status: "DRAFT" } }),
    ).toBe(0);
  }, integrationTestTimeout);

  it("returns the stored single-cycle review without calling AI a second time", async () => {
    const cycle = await createCycle({ cycleNumber: 1, status: "ACTIVE" });
    const ai = new FakeAiClient(reviewResponse);
    const service = new CycleReviewService(db, ai, new CycleService(db));

    await service.generateCycleReview(
      userId,
      cycle.id,
      undefined,
      new Date("2026-10-01T12:00:00Z"),
    );
    const repeated = await service.generateCycleReview(
      userId,
      cycle.id,
      "this note must not trigger a second review",
      new Date("2026-10-02T12:00:00Z"),
    );

    expect(ai.requests).toHaveLength(1);
    expect(repeated.trainingVolume.completedWorkoutCount).toBe(1);
  }, integrationTestTimeout);

  it("includes a shallow previous-cycle comparison only when the previous review exists", async () => {
    const previous = await createCycle({ cycleNumber: 1, status: "ACTIVE" });
    const ai = new FakeAiClient(reviewResponse);
    const service = new CycleReviewService(db, ai, new CycleService(db));

    await service.generateCycleReview(
      userId,
      previous.id,
      undefined,
      new Date("2026-10-01T12:00:00Z"),
    );
    const current = await createCycle({ cycleNumber: 2, status: "ACTIVE" });
    const result = await service.generateCycleReview(
      userId,
      current.id,
      undefined,
      new Date("2026-11-01T12:00:00Z"),
    );

    expect(result.previousCycle?.cycleNumber).toBe(1);
    expect(ai.requests[1]?.userPrompt).toContain("previousCycle");
  }, integrationTestTimeout);

  it("reviews exactly cycles 1–4 and only then allows a next-cycle draft", async () => {
    const cycles = await Promise.all(
      [1, 2, 3, 4].map((cycleNumber) =>
        createCycle({ cycleNumber, status: "CLOSED" }),
      ),
    );
    const ai = new FakeAiClient((request) =>
      request.metadata?.feature === "four-cycle-review"
        ? reviewResponse
        : nextPlanResponse,
    );
    const service = new CycleReviewService(
      db,
      ai,
      new CycleService(db),
      new PlanService(db, ai, "test-model"),
      "test-model",
    );

    const status = await service.getBatchReviewStatus(userId, cycles[3]!.id);
    expect(status).toMatchObject({
      eligible: true,
      startCycleNumber: 1,
      endCycleNumber: 4,
    });

    const batch = await service.generateBatchReview(
      userId,
      cycles[3]!.id,
      undefined,
      new Date("2026-12-01T12:00:00Z"),
    );

    expect(batch.startCycleNumber).toBe(1);
    expect(batch.endCycleNumber).toBe(4);
    expect(batch.batchVolume.cycles).toHaveLength(4);
    expect(batch.batchVolume.cycles.map((cycle) => cycle.cycleNumber)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(ai.requests[0]?.userPrompt).not.toContain("cycle-5");

    await expect(
      service.generateBatchNextCycleDraft(
        userId,
        cycles[2]!.id,
        batch.reviewId,
        new Date("2026-12-01T12:00:00Z"),
      ),
    ).rejects.toThrow(/completed four-cycle batch/);

    const draft = await service.generateBatchNextCycleDraft(
      userId,
      cycles[3]!.id,
      batch.reviewId,
      new Date("2026-12-01T12:00:00Z"),
    );

    expect(draft.cycle.status).toBe("DRAFT");
    expect(
      await db.scheduledWorkout.count({ where: { cycleId: draft.cycle.id } }),
    ).toBe(0);
    expect(ai.requests[1]?.userPrompt).toContain("trainingVolume");
  }, integrationTestTimeout);

  it("does not close an active cycle when AI review fails", async () => {
    const cycle = await createCycle({ cycleNumber: 1, status: "ACTIVE" });
    const service = new CycleReviewService(
      db,
      new FakeAiClient({ invalid: true }),
      new CycleService(db),
    );

    await expect(
      service.generateCycleReview(
        userId,
        cycle.id,
        undefined,
        new Date("2026-10-01T12:00:00Z"),
      ),
    ).rejects.toThrow();
    await expect(
      db.trainingCycle.findUnique({
        where: { id: cycle.id },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "ACTIVE" });
  }, integrationTestTimeout);

  async function createCycle(input: {
    cycleNumber: number;
    status: "ACTIVE" | "CLOSED";
  }) {
    const startDate = new Date("2026-09-01T00:00:00Z");
    startDate.setUTCDate(startDate.getUTCDate() + (input.cycleNumber - 1) * 28);
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 27);

    return db.trainingCycle.create({
      data: {
        userId,
        cycleNumber: input.cycleNumber,
        startDate,
        endDate,
        timezone: "UTC",
        status: input.status,
        closedAt: input.status === "CLOSED" ? endDate : null,
        workouts: {
          create: {
            userId,
            activityType: "STRENGTH",
            scheduledDate: new Date(startDate.getTime() + 86_400_000),
            location: "GYM",
            durationMinutes: 60,
            status: "COMPLETED",
            completedAt: new Date(startDate.getTime() + 2 * 86_400_000),
            plannedExercises: {
              create: {
                exerciseId: "system-push-up",
                sortOrder: 1,
                plannedSets: {
                  create: { setNumber: 1, targetReps: 10 },
                },
              },
            },
            workoutLog: {
              create: {
                exerciseLogs: {
                  create: {
                    exerciseId: "system-push-up",
                    sortOrder: 1,
                    setLogs: {
                      create: {
                        setNumber: 1,
                        actualReps: 10,
                        actualWeight: 60,
                        weightUnit: "KG",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }
});
