import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { db } from "../../src/db";
import { seedCatalog } from "../../src/catalog/seed";
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
      durationMinutes: 45,
      exercises: [
        {
          exerciseId: "free-exercise-db-Pushups",
          sortOrder: 1,
          restSeconds: 60,
          sets: [{ setNumber: 1, targetReps: 10 }],
        },
      ],
    },
  ],
} as const;

describe("AI plan client contract", () => {
  it("accepts a Cardio plan workout with an activity option and no exercises", () => {
    expect(
      planResponseSchema.safeParse({
        workouts: [{
          scheduledDate: "2026-09-25",
          activityType: "CARDIO",
          activityOptionId: "cardio-rowing-machine",
          durationMinutes: 30,
          plannedDetails: { intensity: "MODERATE" },
          exercises: [],
        }],
      }).success,
    ).toBe(true);
  });

  it("rejects a Cardio plan workout without an activity option", () => {
    expect(
      planResponseSchema.safeParse({
        workouts: [{
          scheduledDate: "2026-09-25",
          activityType: "CARDIO",
          durationMinutes: 30,
          exercises: [],
        }],
      }).success,
    ).toBe(false);
  });

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
    await seedCatalog(db);
    await db.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        profile: {
          create: {
            primaryGoal: "FAT_LOSS",
            gender: "MALE",
            age: 30,
            heightCm: 180,
            weightKg: 80,
            weeklyTrainingDays: 3,
            sessionDurationMinutes: 45,
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
            gender: "FEMALE",
            age: 28,
            heightCm: 165,
            weightKg: 60,
            weeklyTrainingDays: 3,
            sessionDurationMinutes: 45,
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

  it("passes only user-available exercises to the planner", async () => {
    const client = new FakeAiClient(validPlanResponse);
    const service = new PlanService(
      db,
      client,
    );

    const result = await service.generateDraft(userId, cycleId);

    expect(result.workouts[0]?.exercises[0]?.name).toBe("Pushups");
    expect(result.workouts[0]?.exercises[0]).not.toHaveProperty(
      "availableLocations",
    );
    expect(client.requests[0]?.userPrompt).toContain("legalActivityOptionPool");
    expect(client.requests[0]?.userPrompt).toContain("focusAreas");
  }, integrationTestTimeout);

  it("rejects an unknown activity option", async () => {
    const service = new PlanService(
      db,
      new FakeAiClient({
        workouts: [{
          scheduledDate: "2026-12-03T00:00:00Z",
          activityType: "CARDIO",
          activityOptionId: "cardio-not-in-catalog",
          durationMinutes: 30,
          plannedDetails: { modality: "Treadmill", intensity: "LOW" },
          exercises: [],
        }],
      }),
    );

    await expect(service.generateDraft(userId, cycleId)).rejects.toThrow(
      /activity option.*legal/i,
    );
    await expect(
      db.scheduledWorkout.count({ where: { cycleId } }),
    ).resolves.toBe(0);
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
        endDate: new Date("2027-01-07T00:00:00Z"),
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

  it("keeps a single-day plan as a draft until confirmation and blocks occupied dates", async () => {
    const dayCycle = await db.trainingCycle.create({
      data: {
        userId,
        startDate: new Date("2027-02-01T00:00:00Z"),
        endDate: new Date("2027-02-28T00:00:00Z"),
        timezone: "UTC",
        cycleNumber: 99,
        status: "ACTIVE",
      },
    });
    const service = new PlanService(
      db,
      new FakeAiClient({
        workout: {
          scheduledDate: "2027-02-03T00:00:00Z",
          activityType: "STRENGTH",
          durationMinutes: 45,
          exercises: [
            {
              exerciseId: "free-exercise-db-Pushups",
              sortOrder: 1,
              restSeconds: 60,
              sets: [{ setNumber: 1, targetReps: 10 }],
            },
          ],
        },
      }),
    );

    const draft = await service.generateSingleDayDraft(
      userId,
      dayCycle.id,
      {
        scheduledDate: "2027-02-03T12:00:00Z",
        focusAreas: ["FULL_BODY"],
      },
      new Date("2027-02-02T12:00:00Z"),
    );

    expect(draft.workouts).toHaveLength(1);
    expect(draft.workouts[0]?.activityType).toBe("STRENGTH");
    await expect(
      db.scheduledWorkout.count({ where: { cycleId: dayCycle.id } }),
    ).resolves.toBe(0);

    const confirmed = await service.confirmSingleDayDraft(
      userId,
      dayCycle.id,
      draft,
      new Date("2027-02-02T12:00:00Z"),
    );

    expect(confirmed.status).toBe("PLANNED");
    await expect(
      db.scheduledWorkout.count({ where: { cycleId: dayCycle.id } }),
    ).resolves.toBe(1);
    await expect(
      service.generateSingleDayDraft(
        userId,
        dayCycle.id,
        {
          scheduledDate: "2027-02-03T12:00:00Z",
          focusAreas: ["FULL_BODY"],
        },
        new Date("2027-02-02T12:00:00Z"),
      ),
    ).rejects.toThrow(/delete the planned workout/i);

    await db.scheduledWorkout.create({
      data: {
        userId,
        cycleId: dayCycle.id,
        activityType: "CARDIO",
        activityOptionId: "cardio-treadmill-running",
        scheduledDate: new Date("2027-02-04T00:00:00Z"),
        durationMinutes: 30,
        status: "COMPLETED",
        completedAt: new Date("2027-02-04T00:30:00Z"),
      },
    });

    await expect(
      service.generateSingleDayDraft(
        userId,
        dayCycle.id,
        {
          scheduledDate: "2027-02-04T12:00:00Z",
          focusAreas: ["FULL_BODY"],
        },
        new Date("2027-02-02T12:00:00Z"),
      ),
    ).rejects.toThrow(/delete the planned workout/i);
  }, integrationTestTimeout);
});
