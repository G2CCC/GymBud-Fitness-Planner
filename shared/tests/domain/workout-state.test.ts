import { describe, expect, it } from "vitest";
import {
  cancelWorkout,
  completeWorkout,
  rescheduleWorkout,
  updateWorkoutLocation,
} from "@fitness/shared/domain/workouts/state-machine";

const now = new Date("2026-11-04T12:00:00Z");

const plannedWorkout = {
  id: "workout-1",
  status: "PLANNED" as const,
  cycleStatus: "ACTIVE" as const,
  hasNextCycle: false,
  scheduledDate: new Date("2026-11-03T00:00:00Z"),
  location: "GYM" as const,
};

describe("workout state machine", () => {
  it("completes an immediate workout with the supplied current time", () => {
    expect(completeWorkout(plannedWorkout, {}, now)).toMatchObject({
      id: "workout-1",
      status: "COMPLETED",
      completedAt: now,
      cancellationReason: null,
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

  it("cancels a planned workout as a user action", () => {
    expect(cancelWorkout(plannedWorkout)).toMatchObject({
      status: "CANCELLED",
      cancellationReason: "USER",
    });
  });

  it("reschedules and changes the location of a planned workout", () => {
    const rescheduled = rescheduleWorkout(
      plannedWorkout,
      new Date("2026-11-05T00:00:00Z"),
    );
    const moved = updateWorkoutLocation(rescheduled, "HOME");

    expect(moved).toMatchObject({
      status: "PLANNED",
      scheduledDate: new Date("2026-11-05T00:00:00Z"),
      location: "HOME",
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
      cancelWorkout({ ...plannedWorkout, hasNextCycle: true }),
    ).toThrow(/cycle/);
  });
});
