import { describe, expect, it } from "vitest";
import {
  getCycleBatchRange,
  isCycleBatchBoundary,
} from "@fitness/shared/domain/cycles/four-cycle-batch";

describe("fixed four-cycle batches", () => {
  it.each([
    [1, { startCycleNumber: 1, endCycleNumber: 4 }],
    [4, { startCycleNumber: 1, endCycleNumber: 4 }],
    [5, { startCycleNumber: 5, endCycleNumber: 8 }],
    [8, { startCycleNumber: 5, endCycleNumber: 8 }],
    [9, { startCycleNumber: 9, endCycleNumber: 12 }],
    [12, { startCycleNumber: 9, endCycleNumber: 12 }],
  ])("maps cycle %s to its non-overlapping range", (cycleNumber, expected) => {
    expect(getCycleBatchRange(cycleNumber)).toEqual(expected);
  });

  it("only makes every fourth cycle a batch boundary", () => {
    expect(isCycleBatchBoundary(4)).toBe(true);
    expect(isCycleBatchBoundary(8)).toBe(true);
    expect(isCycleBatchBoundary(9)).toBe(false);
    expect(isCycleBatchBoundary(12)).toBe(true);
  });

  it("rejects invalid cycle numbers", () => {
    expect(() => getCycleBatchRange(0)).toThrow();
    expect(() => getCycleBatchRange(1.5)).toThrow();
  });
});

