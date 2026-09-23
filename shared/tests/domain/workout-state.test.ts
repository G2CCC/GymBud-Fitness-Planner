import { describe, expect, it } from "vitest";
import {
  completeWorkout,
  rescheduleWorkout,
} from "@fitness/shared/domain/workouts/state-machine";

const now = new Date("2026-11-04T12:00:00Z");

const plannedWorkout = {
  id: "workout-1",
  status: "PLANNED" as const,
  cycleStatus: "ACTIVE" as const,
  hasNextCycle: false,
  scheduledDate: new Date("2026-11-03T00:00:00Z"),
};

describe("workout state machine", () => {
  it("completes an immediate workout with the supplied current time", () => {
    expect(completeWorkout(plannedWorkout, {}, now)).toEqual({
      id: "workout-1",
      status: "COMPLETED",
      cycleStatus: "ACTIVE",
      hasNextCycle: false,
      scheduledDate: new Date("2026-11-03T00:00:00Z"),
      completedAt: now,
    });
  });

  it("accepts an explicit past timestamp for backfilled completion", () => {
    const completedAt = new Date("2026-11-03T18:30:00Z");

    expect(
      completeWorkout(plannedWorkout, { completedAt }, now).completedAt,
    ).toEqual(completedAt);
  });

  it("rejects a completion timestamp in the future", () => {
    expect(() =>
      completeWorkout(
        plannedWorkout,
        { completedAt: new Date("2026-11-04T12:00:01Z") },
        now,
      ),
    ).toThrow(/future/);
  });

  it("reschedules a planned workout without location state", () => {
    const rescheduled = rescheduleWorkout(
      plannedWorkout,
      new Date("2026-11-05T00:00:00Z"),
    );

    expect(rescheduled).toMatchObject({
      status: "PLANNED",
      scheduledDate: new Date("2026-11-05T00:00:00Z"),
    });
  });

  it("rejects normal writes after a cycle is closed or has a next cycle", () => {
    expect(() =>
      completeWorkout(
        { ...plannedWorkout, cycleStatus: "CLOSED" as const },
        {},
        now,
      ),
    ).toThrow(/cycle/);

    expect(() =>
      rescheduleWorkout(
        { ...plannedWorkout, hasNextCycle: true },
        new Date("2026-11-05T00:00:00Z"),
      ),
    ).toThrow(/cycle/);
  });
});
