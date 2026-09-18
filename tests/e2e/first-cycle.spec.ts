import { expect, test } from "@playwright/test";
import {
  createApiContext,
  hasDatabase,
  resetE2eData,
  signInE2eUser,
} from "./support/database";

test.describe("first cycle E2E flow", () => {
  test.skip(!hasDatabase, "DATABASE_URL is required for database-backed E2E runs");

  test.beforeEach(async () => {
    await resetE2eData();
  });

  test("creates, confirms, and completes the first planned workout", async ({
    page,
    playwright,
  }) => {
  const api = await createApiContext(playwright);

  try {
    const profileResponse = await api.put("/profile", {
      data: {
        primaryGoal: "FAT_LOSS",
        weeklyTrainingDays: 3,
        sessionDurationMinutes: 45,
        gender: "MALE",
        age: 27,
        heightCm: 178,
        weightKg: 82,
      },
    });
    expect(profileResponse.ok()).toBeTruthy();

    const draftResponse = await api.post("/cycles", {
      data: {
        primaryGoal: "FAT_LOSS",
        weeklyTrainingDays: 3,
        sessionDurationMinutes: 45,
        gender: "MALE",
        age: 27,
        heightCm: 178,
        weightKg: 82,
        timezone: "UTC",
      },
    });
    const draft = (await draftResponse.json()).data;

    const generatedResponse = await api.post(`/ai/plans/${draft.id}/generate`);
    expect(generatedResponse.ok()).toBeTruthy();
    const generatedPlan = (await generatedResponse.json()).data;

    const confirmedResponse = await api.post(`/ai/plans/${draft.id}/confirm`, {
      data: generatedPlan,
    });
    expect(confirmedResponse.ok()).toBeTruthy();

    await signInE2eUser(page);
    await page.goto("/calendar");
    const workoutCard = page.getByRole("button", {
      name: /strength workout on/i,
    });
    await expect(workoutCard).toBeVisible();
    await workoutCard.click();
    await page.getByRole("link", { name: "Open workout" }).click();
    await page.getByRole("button", { name: "Save workout" }).click();
    await expect(page.getByRole("status")).toContainText("completed");

    await page.goto("/calendar");
    await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  } finally {
    await api.dispose();
  }
  });
});
