import { expect, test } from "@playwright/test";
import {
  createApiContext,
  createExpiredCycleFixture,
  hasDatabase,
  resetE2eData,
} from "./support/database";

test.describe("backfill and cycle close E2E flow", () => {
  test.skip(!hasDatabase, "DATABASE_URL is required for database-backed E2E runs");

  test.beforeEach(async () => {
    await resetE2eData();
  });

  test("requires a backfill timestamp and closes unresolved work in the old cycle", async ({
    playwright,
  }) => {
  const api = await createApiContext(playwright);
  const fixture = await createExpiredCycleFixture();

  try {
    const missingTimestamp = await api.post(
      `/workouts/${fixture.backfillWorkout.id}/backfill`,
      { data: {} },
    );
    expect(missingTimestamp.status()).toBe(400);

    const completedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const backfilled = await api.post(
      `/workouts/${fixture.backfillWorkout.id}/backfill`,
      { data: { completedAt } },
    );
    expect(backfilled.ok()).toBeTruthy();
    expect((await backfilled.json()).data.status).toBe("COMPLETED");

    const reviewResponse = await api.post(
      `/cycles/${fixture.cycle.id}/review`,
      { data: {} },
    );
    expect(reviewResponse.ok()).toBeTruthy();

    const unresolved = await api.get(
      `/workouts/${fixture.unresolvedWorkout.id}`,
    );
    expect((await unresolved.json()).data).toMatchObject({
      status: "CANCELLED",
    });

    const editAfterClose = await api.post(
      `/workouts/${fixture.unresolvedWorkout.id}/reschedule`,
      { data: { scheduledDate: new Date().toISOString() } },
    );
    expect(editAfterClose.status()).toBe(409);
  } finally {
    await api.dispose();
  }
  });
});
