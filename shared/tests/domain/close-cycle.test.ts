import { describe, expect, it } from "vitest";
import {
  assertCycleWritable,
  closeCycle,
  restoreAutoCancelledWorkout,
} from "@fitness/shared/domain/cycles/close-cycle";

const now = new Date("2026-10-07T12:00:00Z");

describe("cycle closure", () => {
  it("auto-cancels unresolved planned workouts in the old cycle", () => {
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
          { id: "cancelled-1", status: "CANCELLED", cancellationReason: "USER" },
        ],
      },
      now,
    );

    expect(result.cycleStatus).toBe("CLOSED");
    expect(result.cancelledWorkoutIds).toEqual(["planned-1"]);
    expect(result.workoutUpdates).toEqual([
      {
        id: "planned-1",
        status: "CANCELLED",
        cancellationReason: "AUTO_CYCLE_CLOSE",
      },
    ]);
    expect(result.nextCycleMayBeGenerated).toBe(true);
  });

  it("allows an auto-cancelled workout to be restored before a next cycle exists", () => {
    const restored = restoreAutoCancelledWorkout({
      cycleStatus: "CLOSED",
      hasNextCycle: false,
      workout: {
        status: "CANCELLED",
        cancellationReason: "AUTO_CYCLE_CLOSE",
      },
      newScheduledDate: new Date("2026-10-08T00:00:00Z"),
    });

    expect(restored).toEqual({
      status: "PLANNED",
      cancellationReason: null,
      scheduledDate: new Date("2026-10-08T00:00:00Z"),
    });
  });

  it("rejects restoration after the next cycle exists", () => {
    expect(() =>
      restoreAutoCancelledWorkout({
        cycleStatus: "CLOSED",
        hasNextCycle: true,
        workout: {
          status: "CANCELLED",
          cancellationReason: "AUTO_CYCLE_CLOSE",
        },
        newScheduledDate: new Date("2026-10-08T00:00:00Z"),
      }),
    ).toThrow();
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
