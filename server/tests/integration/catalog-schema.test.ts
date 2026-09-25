import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "../../src/db";

describe.skipIf(!process.env.DATABASE_URL)("catalog schema", () => {
  it("exposes ActivityOption and imported Exercise metadata", async () => {
    const option = await db.activityOption.findUnique({ where: { id: "cardio-rowing-machine" } });
    expect(option?.activityType).toBe("CARDIO");

    const exercise = await db.exercise.findUnique({ where: { id: "free-exercise-db-Pushups" } });
    expect(exercise?.sourceProvider).toBe("free-exercise-db");
    expect(exercise?.imagePaths).toHaveLength(2);
  });
});

afterAll(async () => {
  await db.$disconnect();
});
