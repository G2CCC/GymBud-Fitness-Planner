import "dotenv/config";
import { randomUUID } from "node:crypto";
import { describe, it, expect, afterAll } from "vitest";
import { db } from "../../src/db";
import { ProfileService } from "../../src/profiles/service";
import { NutritionDiary } from "../../src/nutrition/diary";
import { CycleReviewService } from "../../src/reviews/service";
import { FakeAiClient } from "../../src/ai/fake-client";
import type { AiRequest } from "../../src/ai/client";
const response = {
  processedSummary: "Training recorded.",
  conclusions: {
    status: "CONTINUE",
    keyFindings: ["Recorded sessions."],
    recommendations: ["Continue steadily."],
  },
  nutritionReview: {
    status: "AVAILABLE",
    observations: ["Three complete days were recorded."],
    suggestions: ["Continue recording portions."],
  },
};
describe.skipIf(!process.env.DATABASE_URL)(
  "frozen cycle nutrition review",
  () => {
    const users: string[] = [],
      foods: string[] = [];
    const now = new Date("2026-09-28T12:00:00Z");
    async function fixture() {
      const id = randomUUID();
      users.push(id);
      await db.user.create({ data: { id, email: `${id}@review.test` } });
      await new ProfileService(db).saveProfile(
        id,
        {
          sex: "MALE",
          age: 27,
          heightCm: 180,
          weightKg: 80,
          primaryGoal: "FAT_LOSS",
          weeklyTrainingDays: 3,
          sessionDurationMinutes: 60,
          recordingTimezone: "UTC",
        },
        new Date("2026-09-20"),
      );
      const cycle = await db.trainingCycle.create({
        data: {
          userId: id,
          cycleNumber: 1,
          startDate: new Date("2026-09-21"),
          endDate: new Date("2026-09-27"),
          timezone: "UTC",
          status: "ACTIVE",
        },
      });
      const food = await db.food.create({
        data: {
          sourceProvider: id,
          sourceRelease: "test",
          sourceId: "1",
          name: "Rice",
          kcalPer100g: 100,
          proteinPer100g: 2,
          carbsPer100g: 20,
          fatPer100g: 1,
        },
      });
      foods.push(food.id);
      return { id, cycle, food, diary: new NutritionDiary(db, () => now) };
    }
    afterAll(async () => {
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.food.deleteMany({ where: { id: { in: foods } } });
      await db.$disconnect();
    });
    it("freezes training and nutrition before AI; later food edits cannot change the report", async () => {
      const f = await fixture();
      let firstEntry = "";
      for (const date of ["2026-09-25", "2026-09-26", "2026-09-27"]) {
        const saved = await f.diary.add(f.id, {
          date,
          foodId: f.food.id,
          quantity: 100,
          unit: "g",
          mealType: "LUNCH",
          expectedRevision: 0,
          clientRequestId: randomUUID(),
        });
        firstEntry = saved.entry.id;
        await f.diary.setCompletion(f.id, date, {
          complete: true,
          expectedRevision: 1,
        });
      }
      let started!: () => void, finish!: () => void;
      const invoked = new Promise<void>((r) => (started = r)),
        release = new Promise<void>((r) => (finish = r));
      const ai = new FakeAiClient(async () => {
        started();
        await release;
        return response;
      });
      const service = new CycleReviewService(db, ai);
      const profile = await db.userProfile.findUnique({
        where: { userId: f.id },
      });
      const training = await service.buildTrainingVolume(f.id, f.cycle.id);
      const pending = service.generateWeeklyReview(f.id, f.cycle.id, now);
      await invoked;
      try {
        await f.diary.update(f.id, firstEntry, {
          quantity: 900,
          unit: "g",
          mealType: "LUNCH",
          expectedRevision: 2,
        });
      } finally {
        finish();
      }
      const result = await pending;
      const prompt = JSON.parse(ai.requests[0].userPrompt);
      const stored = await db.cycleReviewSnapshot.findUniqueOrThrow({
        where: { cycleId: f.cycle.id },
      });
      expect(result.nutritionSummary).toEqual(prompt.nutritionSummary);
      expect(result.nutritionSummary.averageFood?.kcal).toBe(100);
      expect(stored.nutritionSummary).toMatchObject({
        summary: prompt.nutritionSummary,
      });
      expect(stored.objectiveSummary).toEqual(training);
      expect(
        await db.userProfile.findUnique({ where: { userId: f.id } }),
      ).toEqual(profile);
      expect(
        (
          await service.generateWeeklyReview(
            f.id,
            f.cycle.id,
            new Date("2026-09-29"),
          )
        ).nutritionSummary,
      ).toEqual(result.nutritionSummary);
    });
    it("retries AI against the same snapshot and deterministically gates insufficient data", async () => {
      const f = await fixture();
      let calls = 0;
      const ai = new FakeAiClient((_request: AiRequest) => {
        if (++calls === 1) throw Error("Temporary provider error");
        return response;
      });
      const service = new CycleReviewService(db, ai);
      await expect(
        service.generateWeeklyReview(f.id, f.cycle.id, now),
      ).rejects.toMatchObject({ statusCode: 502 });
      await f.diary.setCompletion(f.id, "2026-09-27", {
        complete: true,
        expectedRevision: 0,
      });
      const result = await service.processDueWeeklyCycle(
        f.id,
        f.cycle.id,
        new Date("2026-09-29"),
      );
      expect(result?.nutritionSummary.completeFoodDays).toBe(0);
      expect(result?.nutritionReview.status).toBe("INSUFFICIENT_DATA");
      expect(result?.nextCycleEligibility).toBe("RESET_REQUIRED");
      expect(ai.requests[1].userPrompt).toBe(ai.requests[0].userPrompt);
    });
  },
);
