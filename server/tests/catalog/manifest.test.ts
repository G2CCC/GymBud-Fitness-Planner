import { describe, expect, it } from "vitest";
import {
  selectedStrengthExercises,
  type StrengthCatalogSeed,
} from "../../src/catalog/data/strength-exercises";

const focusAreas = ["CHEST", "SHOULDERS", "BACK", "LEGS", "ARMS", "CORE"] as const;

describe("curated Strength manifest", () => {
  it("contains 60 to 70 unique source records", () => {
    const ids = selectedStrengthExercises.map((exercise) => exercise.sourceId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(60);
    expect(ids.length).toBeLessThanOrEqual(70);
  });

  it("contains 10 to 12 primary actions for every focus area", () => {
    for (const focusArea of focusAreas) {
      const count = selectedStrengthExercises.filter(
        (exercise) => exercise.primaryFocusArea === focusArea,
      ).length;
      expect(count).toBeGreaterThanOrEqual(10);
      expect(count).toBeLessThanOrEqual(12);
    }
  });

  it("requires both source images and stable metadata", () => {
    for (const exercise of selectedStrengthExercises as readonly StrengthCatalogSeed[]) {
      expect(exercise.sourceId).toBeTruthy();
      expect(exercise.name).toBeTruthy();
      expect(exercise.images).toHaveLength(2);
      expect(exercise.focusAreas.length).toBeGreaterThanOrEqual(1);
      expect(exercise.instructions.length).toBeGreaterThanOrEqual(1);
    }
  });
});
