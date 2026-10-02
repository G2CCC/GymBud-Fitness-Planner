import { expect, test } from "@playwright/test";
import {
  createApiContext,
  e2eUserId,
  hasDatabase,
  resetE2eData,
  signInE2eUser,
} from "./support/database";
test.describe("nutrition and exercise end to end", () => {
  test.skip(!hasDatabase, "Requires an isolated DATABASE_URL");
  test.beforeEach(async () => {
    await resetE2eData();
  });
  test("records meals without an active cycle and freezes a reviewed cycle", async ({
    page,
    playwright,
  }) => {
    const api = await createApiContext(playwright);
    const { db } = await import("../../server/src/db");
    const today = new Date().toISOString().slice(0, 10),
      yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const rice = await db.food.upsert({
      where: {
        sourceProvider_sourceRelease_sourceId: {
          sourceProvider: "E2E",
          sourceRelease: "test",
          sourceId: "rice",
        },
      },
      create: {
        sourceProvider: "E2E",
        sourceRelease: "test",
        sourceId: "rice",
        name: "E2E cooked rice",
        kcalPer100g: 130,
        proteinPer100g: 2.7,
        carbsPer100g: 28,
        fatPer100g: 0.3,
      },
      update: { active: true },
    });
    const egg = await db.food.upsert({
      where: {
        sourceProvider_sourceRelease_sourceId: {
          sourceProvider: "E2E",
          sourceRelease: "test",
          sourceId: "egg",
        },
      },
      create: {
        sourceProvider: "E2E",
        sourceRelease: "test",
        sourceId: "egg",
        name: "E2E egg",
        kcalPer100g: 150,
        proteinPer100g: 12,
        carbsPer100g: 1,
        fatPer100g: 10,
        portions: {
          create: {
            sourcePortionId: "large",
            label: "large",
            quantity: 1,
            grams: 50,
            unitGrams: 50,
          },
        },
      },
      update: { active: true },
    });
    try {
      await signInE2eUser(page);
      await page.goto("/profile");
      await page.getByLabel(/Height \(cm\)/).fill("180");
      await page.getByLabel(/Body weight/).fill("80");
      await page.getByRole("button", { name: "Save profile" }).click();
      await expect(page.getByRole("status")).toContainText("Profile saved");
      await page.goto("/nutrition");
      await expect(
        page.getByRole("heading", { name: "Nutrition", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Not recorded", { exact: true }),
      ).toBeVisible();
      async function addFood(
        meal: string,
        name: string,
        quantity: string,
        unit = "g",
      ) {
        await page.getByRole("button", { name: "Add to " + meal }).click();
        await page.getByLabel("Search foods").fill(name);
        await page.getByRole("button", { name, exact: true }).click();
        await page.getByRole("combobox", { name:"Unit", exact: true }).selectOption(unit);
        await page.getByLabel("Quantity", { exact: true }).fill(quantity);
        await page
          .getByRole("button", { name: "Save food", exact: true })
          .click();
        await expect(page.getByRole("dialog")).toBeHidden();
      }
      await addFood("Lunch", rice.name, "200");
      await addFood("Breakfast", egg.name, "1.5", "ea");
      await page.getByRole("button", { name: "Mark diary complete" }).click();
      await expect(
        page.getByText("Diary complete", { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Edit " + rice.name }).click();
      await page.getByLabel("Quantity", { exact: true }).fill("250");
      await page.getByRole("button", { name: "Save food" }).click();
      await expect(
        page.getByText("Diary incomplete", { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Mark diary complete" }).click();
      await expect(
        page.getByText("Diary complete", { exact: true }),
      ).toBeVisible();
      const before = (
        await (await api.get("/api/nutrition/day?date=" + today)).json()
      ).data;
      const yesterdayBefore = (
        await (await api.get("/api/nutrition/day?date=" + yesterday)).json()
      ).data;
      const cycle = await db.trainingCycle.create({
        data: {
          userId: e2eUserId,
          cycleNumber: 1,
          startDate: new Date(Date.now() - 6 * 86400000),
          endDate: new Date(today),
          timezone: "UTC",
          status: "ACTIVE",
        },
      });
      async function createWorkout(
        activityType: string,
        extra: Record<string, unknown>,
      ) {
        const response = await api.post("/api/workouts", {
          data: {
            activityType,
            scheduledDate: today + "T00:00:00Z",
            durationMinutes: 30,
            ...extra,
          },
        });
        expect(response.ok()).toBeTruthy();
        return (await response.json()).data;
      }
      const strength = await createWorkout("STRENGTH", {
        plannedExercises: [
          {
            exerciseId: "free-exercise-db-Pushups",
            sortOrder: 1,
            restSeconds: 60,
            sets: [
              {
                setNumber: 1,
                targetReps: 10,
                plannedWeight: 0,
                weightUnit: "KG",
              },
            ],
          },
        ],
      });
      const cardio = await createWorkout("CARDIO", {
        activityOptionId: "cardio-treadmill-running",
      });
      const backfill = await createWorkout("SPORT", {
        activityOptionId: "sport-basketball",
      });
      await page.goto("/workouts/" + strength.id);
      await page.getByRole("button", { name: "Save workout" }).click();
      await expect(
        page.getByText(/Estimated exercise calories:/),
      ).toBeVisible();
      await page.goto("/workouts/" + cardio.id);
      await page.getByRole("button", { name: "Save workout" }).click();
      await expect(
        page.getByText(/Estimated exercise calories: 300 kcal/),
      ).toBeVisible();
      const after = (
        await (await api.get("/api/nutrition/day?date=" + today)).json()
      ).data;
      expect(after.target).toEqual(before.target);
      expect(after.food).toEqual(before.food);
      expect(after.netKcal).toBeLessThan(before.netKcal);
      expect(after.completedAt).toEqual(before.completedAt);
      const filled = await api.post("/api/workouts/" + backfill.id + "/backfill", {
        data: {
          completedAt: yesterday + "T12:00:00Z",
          log: { actualDurationMinutes: 30 },
        },
      });
      expect(filled.ok()).toBeTruthy();
      const prior = (
        await (await api.get("/api/nutrition/day?date=" + yesterday)).json()
      ).data;
      expect(prior.exercise.estimatedKcal).toBe(260);
      expect(prior.target).toEqual(yesterdayBefore.target);
      await page.goto("/profile");
      await page.getByLabel(/Body weight/).fill("85");
      await page.getByRole("button", { name: "Save profile" }).click();
      await expect(page.getByRole("status")).toContainText("Profile saved");
      const priorAfter = (
        await (await api.get("/api/nutrition/day?date=" + yesterday)).json()
      ).data;
      expect(priorAfter).toEqual(prior);
      await page.goto("/review/" + cycle.id);
      await expect(
        page.getByRole("heading", { name: "Nutrition this cycle" }),
      ).toBeVisible();
      await expect(page.getByText(/1 of 7 days complete/)).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/nutrition");
      await expect(
        page
          .getByRole("navigation", { name: "Mobile navigation" })
          .getByRole("link"),
      ).toHaveCount(4);
      await page.getByRole("button", { name: "Add to Dinner" }).click();
      await expect(page.getByLabel("Search foods")).toBeFocused();
      await page.screenshot({path:"test-results/nutrition-mobile-dialog.png"});
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
      await page.screenshot({
        path: "test-results/nutrition-mobile.png",
        fullPage: true,
      });
    } finally {
      await api.dispose();
    }
  });
});
