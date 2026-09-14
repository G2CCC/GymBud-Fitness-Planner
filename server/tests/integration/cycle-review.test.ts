import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
  processedSummary: "The cycle was completed consistently enough to continue.",
  conclusions: {
    status: "CONTINUE",
    keyFindings: ["One strength session was completed."],
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

describe.skipIf(!hasDatabase)("cycle review persistence", () => {
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

  afterAll(async () => {
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  }, integrationTestTimeout);

  it("persists the processed review while omitting an empty raw summary", async () => {
    const cycle = await createCycle({ completed: true });
    const ai = new FakeAiClient((request) =>
      request.metadata?.feature === "cycle-review"
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

    const result = await service.generateCycleReview(
      userId,
      cycle.id,
      "",
      new Date("2026-11-29T12:00:00Z"),
    );

    expect(result.processedSummary).toBe(reviewResponse.processedSummary);
    expect(result.nextCycleEligibility).toBe("ELIGIBLE");
    expect(ai.requests[0]?.userPrompt).not.toContain("optionalUserSummary");

    const snapshot = await db.cycleReviewSnapshot.findUniqueOrThrow({
      where: { cycleId: cycle.id },
    });
    expect(snapshot.processedSummary).toBe(reviewResponse.processedSummary);
    expect(JSON.stringify(snapshot)).not.toContain("optional raw summary");
    expect(snapshot.conclusions).toEqual(reviewResponse.conclusions);
  }, integrationTestTimeout);

  it("passes a supplied summary to AI without persisting the raw text", async () => {
    const cycle = await createCycle({ completed: true });
    const rawSummary = "optional raw summary that must not be stored";
    const ai = new FakeAiClient(reviewResponse);
    const service = new CycleReviewService(
      db,
      ai,
      new CycleService(db),
      new PlanService(db, ai, "test-model"),
      "test-model",
    );

    await service.generateCycleReview(
      userId,
      cycle.id,
      rawSummary,
      new Date("2026-11-29T12:00:00Z"),
    );

    expect(ai.requests[0]?.userPrompt).toContain(rawSummary);
    const snapshot = await db.cycleReviewSnapshot.findUniqueOrThrow({
      where: { cycleId: cycle.id },
    });
    expect(JSON.stringify(snapshot)).not.toContain(rawSummary);
  }, integrationTestTimeout);

  it("persists a direct AI result and leaves the next cycle as an unconfirmed draft", async () => {
    const cycle = await createCycle({ completed: true });
    const ai = new FakeAiClient((request) =>
      request.metadata?.feature === "cycle-review"
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

    const review = await service.generateCycleReview(
      userId,
      cycle.id,
      undefined,
      new Date("2026-11-29T12:00:00Z"),
    );
    const draft = await service.generateNextCycleDraft(
      userId,
      cycle.id,
      review.reviewId,
      new Date("2026-12-01T12:00:00Z"),
    );
    const repeatedDraft = await service.generateNextCycleDraft(
      userId,
      cycle.id,
      review.reviewId,
      new Date("2026-12-02T12:00:00Z"),
    );

    expect(draft.cycle.status).toBe("DRAFT");
    expect(draft.plan.workouts).toHaveLength(1);
    expect(repeatedDraft.cycle.id).toBe(draft.cycle.id);
    expect(ai.requests[1]?.userPrompt).toContain("previousCycleReview");
    await expect(
      db.scheduledWorkout.count({ where: { cycleId: draft.cycle.id } }),
    ).resolves.toBe(0);
    await expect(
      db.trainingCycle.findUnique({
        where: { id: draft.cycle.id },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "DRAFT" });

    await new PlanService(db, ai, "test-model").confirmDraft(
      userId,
      draft.cycle.id,
      draft.plan,
    );
    await expect(
      service.generateNextCycleDraft(userId, cycle.id, review.reviewId),
    ).rejects.toThrow(/already been confirmed/i);
  }, integrationTestTimeout);

  it("rejects a review result when workout facts change during AI generation", async () => {
    const cycle = await createCycle({ completed: true });
    const ai = new FakeAiClient(async () => {
      const workout = await db.scheduledWorkout.findFirst({
        where: { cycleId: cycle.id },
        select: { id: true },
      });
      if (!workout) {
        throw new Error("Test fixture did not create a workout");
      }
      await db.scheduledWorkout.update({
        where: { id: workout.id },
        data: { durationMinutes: 61 },
      });
      return reviewResponse;
    });
    const service = new CycleReviewService(
      db,
      ai,
      new CycleService(db),
      new PlanService(db, ai, "test-model"),
      "test-model",
    );

    await expect(
      service.generateCycleReview(
        userId,
        cycle.id,
        undefined,
        new Date("2026-11-29T12:00:00Z"),
      ),
    ).rejects.toThrow(/changed while the review was generating/i);
    await expect(
      db.trainingCycle.findUnique({
        where: { id: cycle.id },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "ACTIVE" });
  }, integrationTestTimeout);

  it("does not close or auto-cancel an active cycle when AI review fails", async () => {
    const cycle = await createCycle({ completed: true });
    const ai = new FakeAiClient({ invalid: true });
    const service = new CycleReviewService(
      db,
      ai,
      new CycleService(db),
      new PlanService(db, ai, "test-model"),
      "test-model",
    );

    await expect(
      service.generateCycleReview(
        userId,
        cycle.id,
        undefined,
        new Date("2026-11-29T12:00:00Z"),
      ),
    ).rejects.toThrow();

    await expect(
      db.trainingCycle.findUnique({
        where: { id: cycle.id },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "ACTIVE" });
    await expect(
      db.scheduledWorkout.findFirst({
        where: { cycleId: cycle.id },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "COMPLETED" });
  }, integrationTestTimeout);

  it("closes an empty cycle with reset required and does not create a draft", async () => {
    const cycle = await createCycle({ completed: false });
    const ai = new FakeAiClient(reviewResponse);
    const service = new CycleReviewService(
      db,
      ai,
      new CycleService(db),
      new PlanService(db, ai, "test-model"),
      "test-model",
    );

    const review = await service.generateCycleReview(
      userId,
      cycle.id,
      undefined,
      new Date("2026-11-29T12:00:00Z"),
    );

    expect(review.nextCycleEligibility).toBe("RESET_REQUIRED");
    await expect(
      service.generateNextCycleDraft(userId, cycle.id, review.reviewId),
    ).rejects.toThrow(/reset/i);
    await expect(
      db.trainingCycle.count({
        where: { userId, startDate: { gt: cycle.startDate } },
      }),
    ).resolves.toBe(0);
  }, integrationTestTimeout);

  async function createCycle({ completed }: { completed: boolean }) {
    return db.trainingCycle.create({
      data: {
        userId,
        startDate: new Date("2026-11-01T00:00:00Z"),
        endDate: new Date("2026-11-28T00:00:00Z"),
        timezone: "UTC",
        status: "ACTIVE",
        workouts: {
          create: [
            {
              userId,
              activityType: "STRENGTH",
              scheduledDate: new Date("2026-11-10T00:00:00Z"),
              location: "GYM",
              durationMinutes: 60,
              status: completed ? "COMPLETED" : "PLANNED",
              completedAt: completed
                ? new Date("2026-11-10T10:00:00Z")
                : null,
              plannedExercises: {
                create: {
                  exerciseId: "system-push-up",
                  sortOrder: 1,
                  plannedSets: {
                    create: { setNumber: 1, targetReps: 10 },
                  },
                },
              },
              ...(completed
                ? {
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
                              },
                            },
                          },
                        },
                      },
                    },
                  }
                : {}),
            },
          ],
        },
      },
    });
  }
});
