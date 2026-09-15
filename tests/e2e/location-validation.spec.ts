import { expect, test } from "@playwright/test";
import {
  createApiContext,
  createLocationFixture,
  hasDatabase,
  resetE2eData,
} from "./support/database";

test.describe("location validation E2E flow", () => {
  test.skip(!hasDatabase, "DATABASE_URL is required for database-backed E2E runs");

  test.beforeEach(async () => {
    await resetE2eData();
  });

  test("filters location exercises and rejects equipment logs at home", async ({
    playwright,
  }) => {
  const api = await createApiContext(playwright);
  const fixture = await createLocationFixture();

  try {
    const moved = await api.patch(
      `/workouts/${fixture.workout.id}/location`,
      { data: { location: "HOME" } },
    );
    expect(moved.ok()).toBeTruthy();

    const homeExercises = await api.get("/exercises?location=HOME");
    const homeExerciseData = (await homeExercises.json()).data as Array<{
      id: string;
    }>;
    expect(homeExerciseData.some((exercise) => exercise.id === "system-push-up")).toBe(true);
    expect(
      homeExerciseData.some(
        (exercise) => exercise.id === "system-barbell-bench-press",
      ),
    ).toBe(false);

    const equipmentLog = await api.put(`/workouts/${fixture.workout.id}/log`, {
      data: {
        exercises: [
          {
            exerciseId: "system-barbell-bench-press",
            sortOrder: 1,
            sets: [{ setNumber: 1, reps: 8, weight: 40, weightUnit: "KG" }],
          },
        ],
      },
    });
    expect(equipmentLog.status()).toBe(400);

    const bodyweightLog = await api.put(`/workouts/${fixture.workout.id}/log`, {
      data: {
        exercises: [
          {
            exerciseId: "system-push-up",
            sortOrder: 1,
            sets: [{ setNumber: 1, reps: 10 }],
          },
        ],
      },
    });
    expect(bodyweightLog.ok()).toBeTruthy();
  } finally {
    await api.dispose();
  }
  });
});
