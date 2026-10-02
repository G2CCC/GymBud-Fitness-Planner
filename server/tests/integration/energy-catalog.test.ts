import { describe, it, expect } from "vitest";
import { activityOptions } from "../../src/catalog/activity-options";
import { selectedStrengthExercises } from "../../src/catalog/data/strength-exercises";
import {
  activityEnergy,
  getActivityEnergy,
} from "../../src/catalog/activity-energy";
import {
  strengthEnergyModes,
  isStrengthEnergySupported,
} from "../../src/catalog/strength-energy";
describe("energy catalog coverage", () => {
  it("classifies every current activity and requires a reference for estimates", () => {
    expect(Object.keys(activityEnergy).sort()).toEqual(
      activityOptions.map((x) => x.id).sort(),
    );
    for (const activity of activityOptions) {
      const energy = getActivityEnergy(activity.id);
      if (energy) {
        expect(energy.met).toBeGreaterThan(0);
        expect(energy.referenceCode).toMatch(/^\d{5}$/);
      }
    }
  });
  it("has an explicit classification for every strength movement", () => {
    expect(Object.keys(strengthEnergyModes).sort()).toEqual(
      selectedStrengthExercises.map((x) => x.id).sort(),
    );
    expect(isStrengthEnergySupported("free-exercise-db-Plank")).toBe(false);
    expect(isStrengthEnergySupported("free-exercise-db-Pushups")).toBe(true);
    expect(isStrengthEnergySupported("unknown")).toBe(false);
  });
});
