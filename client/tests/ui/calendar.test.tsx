import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { WorkoutCard } from "../../src/components/calendar/WorkoutCard";
import {
  StrengthPlanBuilder,
  type ManualPlannedExercise,
} from "../../src/components/workouts/StrengthPlanBuilder";
import { WorkoutEditor } from "../../src/components/workouts/WorkoutEditor";
import { getMondayDateKey } from "../../src/components/calendar/CalendarGrid";
import type {
  EditorExerciseOption,
  EditorWorkout,
} from "../../src/components/workouts/WorkoutEditor";

const plannedWorkout: EditorWorkout = {
  id: "workout-1",
  activityType: "STRENGTH",
  scheduledDate: "2026-09-13T09:00:00.000Z",
  durationMinutes: 60,
  status: "PLANNED",
  completedAt: null,
  rescheduleCount: 0,
};

const exerciseOptions: EditorExerciseOption[] = [
  {
    id: "bench",
    name: "Bench Press",
    equipment: "BARBELL",
  },
  {
    id: "push-up",
    name: "Push Up",
    equipment: "NONE",
  },
];

describe("calendar and workout editor UI", () => {
  it("normalizes any selected date to the Monday of its calendar week", () => {
    expect(getMondayDateKey("2026-09-23")).toBe("2026-09-21");
    expect(getMondayDateKey("2026-09-27")).toBe("2026-09-21");
  });

  it("shows an overdue label for a planned workout whose date has passed", () => {
    render(
      <WorkoutCard
        workout={plannedWorkout}
        today="2026-09-14T09:00:00.000Z"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("Planned")).toBeInTheDocument();
  });

  it("shows all legal exercises without location filtering", () => {
    render(
      <WorkoutEditor
        workout={plannedWorkout}
        legalExerciseOptions={exerciseOptions}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("option", { name: /bench press/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /push up/i })).toBeInTheDocument();
  });

  it("requires actual completion date and time during backfill", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <WorkoutEditor
        workout={plannedWorkout}
        legalExerciseOptions={exerciseOptions}
        mode="backfill"
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: /save completion/i }));

    expect(
      screen.getByText("Completion date and time are required."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("builds a manual strength plan with legal exercises and sets", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    function Harness() {
      const [value, setValue] = useState<ManualPlannedExercise[]>([]);
      return (
        <StrengthPlanBuilder
          exercises={exerciseOptions}
          value={value}
          onChange={(nextValue) => {
            setValue(nextValue);
            onChange(nextValue);
          }}
        />
      );
    }

    render(<Harness />);

    await user.click(screen.getByRole("button", { name: /add exercise/i }));
    await user.selectOptions(screen.getByLabelText("Exercise 1"), "bench");
    await user.click(
      screen.getByRole("button", { name: /add set to exercise 1/i }),
    );

    expect(onChange).toHaveBeenLastCalledWith([
      {
        exerciseId: "bench",
        sortOrder: 1,
        sets: [
          { setNumber: 1, targetReps: 8 },
          { setNumber: 2, targetReps: 8 },
        ],
      },
    ]);
  });
});
