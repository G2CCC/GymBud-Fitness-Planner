import { describe, it, expect } from "vitest";
import {
  estimateStrengthEnergy,
  estimateDurationEnergy,
} from "../../src/domain/workouts/energy";
const item = {
  exerciseId: "reps",
  supported: true,
  restSeconds: 60,
  sets: [{ actualReps: 10 }, { actualReps: 10 }, { actualReps: 10 }],
};
describe("workout extra energy", () => {
  it("sums unrounded actions then rounds once", () =>
    expect(estimateStrengthEnergy([item, item], 80).estimatedKcal).toBe(27));
  it("preserves explicit zero rest", () =>
    expect(
      estimateStrengthEnergy([{ ...item, restSeconds: 0 }], 80).estimatedKcal,
    ).toBe(7));
  it("uses default rest and ignores zero-rep groups", () =>
    expect(
      estimateStrengthEnergy(
        [
          {
            ...item,
            restSeconds: undefined,
            sets: [...item.sets, { actualReps: 0 }],
          },
        ],
        80,
      ).estimatedKcal,
    ).toBe(13));
  it("distinguishes supported zero from unknown", () => {
    expect(
      estimateStrengthEnergy([{ ...item, sets: [{ actualReps: 0 }] }], 80),
    ).toMatchObject({ estimatedKcal: 0, coverage: "COMPLETE" });
    expect(
      estimateStrengthEnergy([{ ...item, supported: false }], 80),
    ).toMatchObject({ estimatedKcal: null, coverage: "UNAVAILABLE" });
    expect(
      estimateStrengthEnergy([item, { ...item, supported: false }], 80),
    ).toMatchObject({ estimatedKcal: 13, coverage: "PARTIAL" });
  });
  it("deducts resting energy for time-based activities", () =>
    expect(
      estimateDurationEnergy({
        activityId: "test",
        minutes: 30,
        met: 5,
        bodyWeightKg: 80,
        referenceCode: "fixture",
      }).estimatedKcal,
    ).toBe(160));
  it("rejects invalid actual data", () => {
    expect(() => estimateStrengthEnergy([item], NaN)).toThrow();
    expect(() =>
      estimateStrengthEnergy([{ ...item, sets: [{ actualReps: -1 }] }], 80),
    ).toThrow();
  });
});
