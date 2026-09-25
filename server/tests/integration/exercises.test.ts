import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedCatalog } from "../../src/catalog/seed";
import { ExerciseService } from "../../src/exercises/service";
import { db } from "../../src/db";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const userId = `exercise-test-${randomUUID()}`;
const otherUserId = `exercise-other-test-${randomUUID()}`;
const integrationTestTimeout = 30_000;

describe.skipIf(!hasDatabase)("exercise persistence", () => {
  const service = new ExerciseService(db);

  beforeAll(async () => {
    await seedCatalog(db);
    await Promise.all(
      [userId, otherUserId].map((id) =>
        db.user.create({
          data: {
            id,
            email: `${id}@example.com`,
          },
        }),
      ),
    );
  }, integrationTestTimeout);

  afterAll(async () => {
    await db.exercise.deleteMany({
      where: { ownerId: { in: [userId, otherUserId] } },
    });
    await Promise.all(
      [userId, otherUserId].map((id) =>
        db.user.delete({ where: { id } }),
      ),
    );
    await db.$disconnect();
  }, integrationTestTimeout);

  it("lists system and own custom exercises without location filtering", async () => {
    const ownExercise = await service.createConfirmedCustomExercise(userId, {
      name: "Home Push-up Variation",
      description: "A custom bodyweight pressing variation.",
      equipment: "NONE",
      targetMuscles: ["CHEST", "TRICEPS"],
      movementPattern: "PUSH",
    });
    const otherExercise = await service.createConfirmedCustomExercise(
      otherUserId,
      {
        name: "Other User Exercise",
        equipment: "NONE",
        targetMuscles: ["CORE"],
      },
    );

    const exercises = await service.listAvailableExercises(userId);
    const names = exercises.map((exercise) => exercise.name);

    expect(names).toContain("Pushups");
    expect(names).toContain("Barbell Bench Press - Medium Grip");
    expect(names).toContain(ownExercise.name);
    expect(names).not.toContain(otherExercise.name);
  }, integrationTestTimeout);

  it("filters imported exercises by focus area", async () => {
    const exercises = await service.listAvailableExercises(userId, {
      focusArea: "CHEST",
    });

    expect(exercises.length).toBeGreaterThan(0);
    expect(exercises.every((exercise) => exercise.focusAreas.includes("CHEST"))).toBe(true);
  }, integrationTestTimeout);

  it("keeps equipment availability independent of location", async () => {
    const exercise = await service.createConfirmedCustomExercise(userId, {
      name: "Custom Barbell Exercise",
      equipment: "BARBELL",
      targetMuscles: ["BACK"],
    });

    expect(exercise.name).toBe("Custom Barbell Exercise");
  }, integrationTestTimeout);

  it("does not expose another user's custom exercise by id", async () => {
    const otherExercise = await service.createConfirmedCustomExercise(
      otherUserId,
      {
        name: "Private Custom Exercise",
        equipment: "NONE",
        targetMuscles: ["LEGS"],
      },
    );

    await expect(
      service.getExercise(userId, otherExercise.id),
    ).rejects.toThrow(/not found/);
  }, integrationTestTimeout);
});
