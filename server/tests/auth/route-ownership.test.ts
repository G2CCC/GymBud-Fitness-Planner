import "dotenv/config";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { seedCatalog } from "../../src/catalog/seed";
import { seedTestUser } from "../../src/current-user";
import { db } from "../../src/db";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const userASlug = `route-owner-a-${randomUUID().replaceAll("-", "")}`;
const userBSlug = `route-owner-b-${randomUUID().replaceAll("-", "")}`;
const userAId = userASlug;
let workoutId: string;

describe.skipIf(!hasDatabase)("authenticated route ownership", () => {
  beforeAll(async () => {
    await seedCatalog(db);
    await seedTestUser(userAId);
  });

  afterAll(async () => {
    await db.scheduledWorkout.deleteMany({
      where: { userId: { in: [userAId, userBSlug] } },
    });
    await db.trainingCycle.deleteMany({
      where: { userId: { in: [userAId, userBSlug] } },
    });
    await db.user.deleteMany({
      where: { id: { in: [userAId, userBSlug] } },
    });
    await db.$disconnect();
  });

  it("does not expose one user's profile to another identity", async () => {
    const response = await request(app)
      .get("/api/profile")
      .set("Authorization", `Bearer test-token:${userBSlug}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toBeNull();
  });

  it("does not expose another user's workout by id", async () => {
    const cycle = await db.trainingCycle.create({
      data: {
        userId: userAId,
        startDate: new Date("2026-10-01T00:00:00Z"),
        endDate: new Date("2026-10-28T00:00:00Z"),
        status: "ACTIVE",
      },
    });
    const workout = await db.scheduledWorkout.create({
      data: {
        userId: userAId,
        cycleId: cycle.id,
        activityType: "CARDIO",
        activityOptionId: "cardio-treadmill-running",
        scheduledDate: new Date("2026-10-02T00:00:00Z"),
        durationMinutes: 30,
      },
    });
    workoutId = workout.id;

    const response = await request(app)
      .get(`/api/workouts/${workoutId}`)
      .set("Authorization", `Bearer test-token:${userBSlug}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});
