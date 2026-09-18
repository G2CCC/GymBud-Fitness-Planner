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
import type {
  EditorExerciseOption,
  EditorWorkout,
} from "../../src/components/workouts/WorkoutEditor";

const plannedWorkout: EditorWorkout = {
  id: "workout-1",
  activityType: "STRENGTH",
  scheduledDate: "2026-09-13T09:00:00.000Z",
  location: "GYM",
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
    availableLocations: ["GYM"],
  },
  {
    id: "push-up",
    name: "Push Up",
    equipment: "NONE",
    availableLocations: ["GYM", "HOME"],
  },
];

describe("calendar and workout editor UI", () => {
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

  it("filters legal exercises when the workout location changes", async () => {
    const user = userEvent.setup();

    render(
      <WorkoutEditor
        workout={plannedWorkout}
        location="GYM"
        legalExerciseOptions={exerciseOptions}
        onLocationChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("option", { name: /bench press/i })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Training location"), "HOME");

    expect(
      screen.queryByRole("option", { name: /bench press/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /push up/i })).toBeInTheDocument();
  });

  it("requires actual completion date and time during backfill", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <WorkoutEditor
        workout={plannedWorkout}
        location="GYM"
        legalExerciseOptions={exerciseOptions}
        mode="backfill"
        onLocationChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: /save completion/i }));

    expect(
      screen.getByText("Completion date and time are required."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("builds a manual strength plan with location-legal exercises and sets", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    function Harness() {
      const [value, setValue] = useState<ManualPlannedExercise[]>([]);
      return (
        <StrengthPlanBuilder
          location="GYM"
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
