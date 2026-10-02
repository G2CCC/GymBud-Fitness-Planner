import { it, expect, vi } from "vitest";
import { calculateNutritionTarget } from "@fitness/shared";
import { ProfileService } from "../../src/profiles/service";
import { WorkoutService } from "../../src/workouts/service";
import { NutritionDiary } from "../../src/nutrition/diary";
import type { PrismaClient } from "@prisma/client";

// Controlled interleavings model stale reads independently of a single-connection
// test database. They verify service behavior, not native PostgreSQL lock semantics.
it("keeps a profile and its target consistent when two saves initially see the same body data", async () => {
  const initial = {
    sex: "MALE" as const,
    age: 27,
    heightCm: 180,
    weightKg: 80,
    primaryGoal: "FAT_LOSS" as const,
    weeklyTrainingDays: 3,
    sessionDurationMinutes: 60,
    recordingTimezone: "UTC",
  };
  let profile = { ...initial, nutritionStartedOn: "2026-10-01" },
    target = {
      ...calculateNutritionTarget(initial),
      effectiveDate: "2026-10-01",
    },
    lockTail = Promise.resolve();
  const prisma = {
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => {
      let release: (() => void) | undefined;
      const tx = {
        $queryRaw: async () => {
          const prior = lockTail;
          lockTail = new Promise<void>((r) => (release = r));
          await prior;
          return [{ id: "user" }];
        },
        userProfile: {
          findUnique: async () => {
            const saved = { ...profile };
            await new Promise((r) => setTimeout(r, 0));
            return saved;
          },
          upsert: async ({ update }: any) =>
            (profile = { ...profile, ...update }),
        },
        nutritionTarget: {
          findFirst: async () => ({ ...target }),
          upsert: async ({ create, update }: any) =>
            (target = { ...target, ...create, ...update }),
        },
        nutritionDay: {
          findUnique: async () => null,
          findMany: async () => [],
        },
      };
      try {
        return await work(tx);
      } finally {
        release?.();
      }
    },
  } as unknown as PrismaClient;
  const service = new ProfileService(prisma),
    now = new Date("2026-10-05T12:00:00Z");
  await Promise.all([
    service.saveProfile("user", { ...initial, weightKg: 81 }, now),
    service.saveProfile("user", { ...initial, weeklyTrainingDays: 4 }, now),
  ]);
  expect(target.kcal).toBe(calculateNutritionTarget(profile).kcal);
});

it("rejects a log edit when the cycle closes between lookup and write serialization", async () => {
  let reads = 0;
  const workout = {
    id: "workout",
    userId: "user",
    cycleId: "cycle",
    activityType: "CARDIO",
    status: "COMPLETED",
    cycle: { id: "cycle", status: "ACTIVE", startDate: new Date("2026-10-01") },
  };
  const tx = {
    scheduledWorkout: {
      findFirst: async () => ({
        ...workout,
        cycle: {
          ...workout.cycle,
          status: ++reads === 1 ? "ACTIVE" : "CLOSED",
        },
      }),
    },
    trainingCycle: {
      findFirst: async () => null,
      updateMany: async () => ({ count: 1 }),
    },
  };
  const service = new WorkoutService({
    $transaction: async (fn: any) => fn(tx),
  } as unknown as PrismaClient);
  const persist = vi
    .spyOn(service as any, "saveWorkoutLogInTransaction")
    .mockResolvedValue({});
  await expect(
    service.saveWorkoutLog("user", "workout", { actualDurationMinutes: 30 }),
  ).rejects.toMatchObject({ statusCode: 409 });
  expect(persist).not.toHaveBeenCalled();
});

it("returns the canonical entry when an identical request wins before the revision claim", async () => {
  let lookups = 0;
  const totals = { kcal: 100, proteinG: 10, carbsG: 2, fatG: 5 };
  const input = {
    date: "2026-10-01",
    mealType: "LUNCH" as const,
    foodId: "food",
    quantity: 100,
    unit: "g" as const,
    expectedRevision: 0,
    clientRequestId: "11111111-1111-4111-8111-111111111111",
  };
  const { createHash } = await import("node:crypto");
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify([
        input.date,
        input.mealType,
        input.foodId,
        null,
        input.unit,
        input.quantity,
      ]),
    )
    .digest("hex");
  const row = {
    id: "entry",
    foodId: "food",
    portionId: null,
    mealType: "LUNCH",
    quantity: 100,
    unit: "g",
    grams: 100,
    nameSnapshot: "Food",
    per100gSnapshot: totals,
    unitGramsSnapshot: null,
    ...totals,
    deletedAt: null,
    requestFingerprint: fingerprint,
    day: { revision: 1 },
  };
  const tx = {
    foodLog: { findUnique: async () => (++lookups === 1 ? null : row) },
    userProfile: {
      findUnique: async () => ({
        nutritionStartedOn: "2026-10-01",
        recordingTimezone: "UTC",
      }),
    },
    nutritionDay: {
      findUnique: async () => ({ id: "day", timezone: "UTC", revision: 1 }),
      updateMany: async () => ({ count: 0 }),
    },
    food: {
      findFirst: async () => ({
        id: "food",
        name: "Food",
        kcalPer100g: 100,
        proteinPer100g: 10,
        carbsPer100g: 2,
        fatPer100g: 5,
        portions: [],
      }),
    },
  };
  const diary = new NutritionDiary(
    { $transaction: async (fn: any) => fn(tx) } as unknown as PrismaClient,
    () => new Date("2026-10-01T12:00:00Z"),
  );
  await expect(diary.add("user", input)).resolves.toMatchObject({
    entry: { id: "entry" },
    revision: 1,
  });
});
