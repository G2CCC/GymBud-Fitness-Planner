import "dotenv/config";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { db } from "../../src/db";
import { seedCatalog } from "../../src/catalog/seed";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const userId = `activity-api-${randomUUID()}`;
const otherUserId = `activity-api-other-${randomUUID()}`;
const authHeader = `Bearer test-token:${userId}`;

describe.skipIf(!hasDatabase)("catalog API", () => {
  beforeAll(async () => {
    await seedCatalog(db);
    await Promise.all([
      db.user.create({ data: { id: userId, email: `${userId}@example.test` } }),
      db.user.create({ data: { id: otherUserId, email: `${otherUserId}@example.test` } }),
    ]);
    await db.exercise.create({
      data: {
        ownerId: otherUserId,
        name: "Private user exercise",
        targetMuscles: ["CHEST"],
      },
    });
  }, 30_000);

  afterAll(async () => {
    await db.exercise.deleteMany({ where: { ownerId: otherUserId } });
    await db.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await db.$disconnect();
  }, 30_000);

  it("filters Strength exercises and returns only visible ownership", async () => {
    const response = await request(app)
      .get("/api/exercises?focusArea=CHEST")
      .set("Authorization", authHeader);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data.every((exercise: { focusAreas: string[] }) =>
      exercise.focusAreas.includes("CHEST"),
    )).toBe(true);
    expect(response.body.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Private user exercise" })]),
    );
    expect(response.body.data[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      imageUrls: expect.any(Array),
      focusAreas: expect.any(Array),
    }));
  });

  it("filters ActivityOptions by activity type and sort order", async () => {
    const response = await request(app)
      .get("/api/activity-options?activityType=CARDIO")
      .set("Authorization", authHeader);

    expect(response.status).toBe(200);
    expect(response.body.data.every((option: { activityType: string }) =>
      option.activityType === "CARDIO",
    )).toBe(true);
    expect(response.body.data[0]).toMatchObject({
      id: "cardio-treadmill-running",
      iconKey: expect.any(String),
    });
  });
});
