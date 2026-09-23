import { describe, expect, it } from "vitest";
import {
  assertCycleWritable,
  closeCycle,
} from "@fitness/shared/domain/cycles/close-cycle";

const now = new Date("2026-10-07T12:00:00Z");

describe("cycle closure", () => {
  it("reports unresolved planned workouts without changing their state", () => {
    const result = closeCycle(
      {
        cycleId: "cycle-1",
        cycleStatus: "ACTIVE",
        workouts: [
          { id: "planned-1", status: "PLANNED" },
          {
            id: "completed-1",
            status: "COMPLETED",
            completedAt: new Date("2026-10-06T10:00:00Z"),
          },
        ],
      },
      now,
    );

    expect(result.cycleStatus).toBe("CLOSED");
    expect(result.unresolvedWorkoutIds).toEqual(["planned-1"]);
    expect(result.nextCycleMayBeGenerated).toBe(true);
  });

  it("requires an actual completion timestamp", () => {
    expect(() =>
      closeCycle(
        {
          cycleId: "cycle-1",
          cycleStatus: "ACTIVE",
          workouts: [{ id: "completed-1", status: "COMPLETED" }],
        },
        now,
      ),
    ).toThrow(/completedAt/);
  });

  it("closes a cycle with zero completed workouts and requires a reset", () => {
    const result = closeCycle(
      {
        cycleId: "cycle-1",
        cycleStatus: "ACTIVE",
        workouts: [{ id: "planned-1", status: "PLANNED" }],
      },
      now,
    );

    expect(result.cycleStatus).toBe("CLOSED");
    expect(result.nextCycleMayBeGenerated).toBe(false);
    expect(result.nextCycleEligibility).toBe("RESET_REQUIRED");
  });

  it("rejects normal writes to a closed cycle", () => {
    expect(() => assertCycleWritable("CLOSED", false)).toThrow();
    expect(() => assertCycleWritable("CLOSED", true)).toThrow();
  });
});
