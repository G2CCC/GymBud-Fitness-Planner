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

  test("requires actual logs and resolving planned workouts before closing", async ({
    playwright,
  }) => {
  const api = await createApiContext(playwright);
  const fixture = await createExpiredCycleFixture();

  try {
    const missingTimestamp = await api.post(
      `/api/workouts/${fixture.backfillWorkout.id}/backfill`,
      { data: {} },
    );
    expect(missingTimestamp.status()).toBe(400);

    const completedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const backfilled = await api.post(
      `/api/workouts/${fixture.backfillWorkout.id}/backfill`,
      { data: { completedAt, log:{actualDurationMinutes:30} } },
    );
    expect(backfilled.ok()).toBeTruthy();
    expect((await backfilled.json()).data.status).toBe("COMPLETED");

    const blockedReview = await api.post(`/api/cycles/${fixture.cycle.id}/review`,{data:{}});
    expect((await blockedReview.json()).data).toBeNull();
    const removed=await api.delete(`/api/workouts/${fixture.unresolvedWorkout.id}`);
    expect(removed.ok()).toBeTruthy();
    const reviewResponse = await api.post(
      `/api/cycles/${fixture.cycle.id}/review`,
      { data: {} },
    );
    expect(reviewResponse.ok()).toBeTruthy();

    const unresolved = await api.get(
      `/api/workouts/${fixture.unresolvedWorkout.id}`,
    );
    expect(unresolved.status()).toBe(404);

    const editAfterClose = await api.post(
      `/api/workouts/${fixture.backfillWorkout.id}/reschedule`,
      { data: { scheduledDate: new Date().toISOString() } },
    );
    expect(editAfterClose.status()).toBe(409);
  } finally {
    await api.dispose();
  }
  });
});
