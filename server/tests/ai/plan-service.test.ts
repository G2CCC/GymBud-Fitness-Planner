import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { db } from "../../src/db";
import { seedSystemExercises } from "../../src/exercises/seed";
import { FakeAiClient } from "../../src/ai/fake-client";
import { planResponseSchema } from "../../src/ai/schemas";
import { PlanService } from "../../src/ai/plan-service";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const integrationTestTimeout = 30_000;
const userId = `ai-plan-test-${randomUUID()}`;
const otherUserId = `ai-plan-other-${randomUUID()}`;

const validPlanResponse = {
  workouts: [
    {
      scheduledDate: "2026-12-02T00:00:00Z",
      activityType: "STRENGTH",
      location: "HOME",
      durationMinutes: 45,
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

describe("AI plan client contract", () => {
  it("rejects malformed model JSON after the provider returns", async () => {
    const client = new FakeAiClient("{not-json");

    await expect(
      client.generateJson(
        {
          model: "test-model",
          promptVersion: "plan.v1",
          systemPrompt: "system",
          userPrompt: "user",
        },
        z.object({ ok: z.boolean() }),
      ),
    ).rejects.toThrow();
  });
});

describe.skipIf(!hasDatabase)("AI plan persistence", () => {
  let cycleId: string;
  let otherExerciseId: string;

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
    await db.user.create({
      data: {
        id: otherUserId,
        email: `${otherUserId}@example.com`,
        profile: {
          create: {
            primaryGoal: "MUSCLE_GAIN",
            weeklyTrainingDays: 3,
            sessionDurationMinutes: 45,
            defaultLocation: "HOME",
          },
        },
      },
    });

    const otherExercise = await db.exercise.create({
      data: {
        ownerId: otherUserId,
        name: "Other user's exercise",
        equipment: "NONE",
        targetMuscles: ["CHEST"],
        movementPattern: "PUSH",
        availableLocations: ["GYM", "HOME"],
        aiEligible: true,
      },
    });
    otherExerciseId = otherExercise.id;

    const cycle = await db.trainingCycle.create({
      data: {
        userId,
        startDate: new Date("2026-12-01T00:00:00Z"),
        endDate: new Date("2026-12-28T00:00:00Z"),
        timezone: "UTC",
        status: "DRAFT",
      },
    });
    cycleId = cycle.id;
  }, integrationTestTimeout);

  afterAll(async () => {
    await db.exercise.deleteMany({
      where: { ownerId: { in: [userId, otherUserId] } },
    });
    await Promise.all(
      [userId, otherUserId].map((id) =>
        db.user.delete({ where: { id } }),
      ),
    );
    await db.$disconnect();
  }, integrationTestTimeout);

  it("passes only legal exercises for the workout location", async () => {
    const service = new PlanService(
      db,
      new FakeAiClient(validPlanResponse),
    );

    const result = await service.generateDraft(userId, cycleId);

    expect(
      result.workouts
        .flatMap((workout) => workout.exercises)
        .every((exercise) => exercise.availableLocations.includes("HOME")),
    ).toBe(true);
    expect(result.workouts[0]?.exercises[0]?.name).toBe("Push-up");
  }, integrationTestTimeout);

  it("rejects an exercise owned by another user without writing calendar rows", async () => {
    const service = new PlanService(
      db,
      new FakeAiClient({
        ...validPlanResponse,
        workouts: [
          {
            ...validPlanResponse.workouts[0],
            exercises: [
              {
                ...validPlanResponse.workouts[0].exercises[0],
                exerciseId: otherExerciseId,
              },
            ],
          },
        ],
      }),
    );

    await expect(service.generateDraft(userId, cycleId)).rejects.toThrow(
      /exercise/i,
    );
    await expect(
      db.scheduledWorkout.count({ where: { cycleId } }),
    ).resolves.toBe(0);
  }, integrationTestTimeout);

  it("rejects an empty strength exercise list without writing calendar rows", async () => {
    const service = new PlanService(
      db,
      new FakeAiClient({
        ...validPlanResponse,
        workouts: [
          {
            ...validPlanResponse.workouts[0],
            exercises: [],
          },
        ],
      }),
    );

    await expect(service.generateDraft(userId, cycleId)).rejects.toThrow(
      /strength|exercise/i,
    );
    await expect(
      db.scheduledWorkout.count({ where: { cycleId } }),
    ).resolves.toBe(0);
  }, integrationTestTimeout);

  it("confirms a draft by activating the cycle and creating planned workouts atomically", async () => {
    const service = new PlanService(
      db,
      new FakeAiClient(validPlanResponse),
    );
    const draft = await service.generateDraft(userId, cycleId);

    const confirmed = await service.confirmDraft(userId, cycleId, draft);

    expect(confirmed.status).toBe("ACTIVE");
    await expect(
      db.scheduledWorkout.count({ where: { cycleId } }),
    ).resolves.toBe(1);
    await expect(
      db.plannedExercise.count({
        where: { workout: { cycleId } },
      }),
    ).resolves.toBe(1);
  }, integrationTestTimeout);

  it("does not modify a draft cycle when confirmation validation fails", async () => {
    const secondCycle = await db.trainingCycle.create({
      data: {
        userId,
        startDate: new Date("2027-01-01T00:00:00Z"),
        endDate: new Date("2027-01-28T00:00:00Z"),
        timezone: "UTC",
        status: "DRAFT",
      },
    });
    const service = new PlanService(
      db,
      new FakeAiClient(validPlanResponse),
    );
    const draft = await service.generateDraft(userId, secondCycle.id);
    const invalidDraft = {
      ...draft,
      workouts: [
        ...draft.workouts,
        {
          ...draft.workouts[0],
          exercises: [
            {
              ...draft.workouts[0]!.exercises[0]!,
              exerciseId: otherExerciseId,
            },
          ],
        },
      ],
    };

    await expect(
      service.confirmDraft(userId, secondCycle.id, invalidDraft),
    ).rejects.toThrow(/exercise/i);
    await expect(
      db.trainingCycle.findUnique({ where: { id: secondCycle.id } }),
    ).resolves.toMatchObject({ status: "DRAFT" });
    await expect(
      db.scheduledWorkout.count({ where: { cycleId: secondCycle.id } }),
    ).resolves.toBe(0);
  }, integrationTestTimeout);
});
