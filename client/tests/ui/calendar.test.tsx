import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import * as api from "../../src/api/client";
import type { ApiCycle, ApiWorkout } from "../../src/api/contracts";
import { WorkoutCard } from "../../src/components/calendar/WorkoutCard";
import { CalendarPage } from "../../src/pages/calendar/CalendarPage";
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

vi.mock("../../src/api/client", () => ({
  cancelWorkout: vi.fn(),
  createWorkout: vi.fn(),
  getCalendarWorkouts: vi.fn(),
  getCurrentCycle: vi.fn(),
  getWorkout: vi.fn(),
  listExercises: vi.fn(),
  rescheduleWorkout: vi.fn(),
}));

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

const activeCycle: ApiCycle = {
  id: "cycle-1",
  status: "ACTIVE",
  cycleNumber: 1,
  startDate: "2026-09-01T00:00:00.000Z",
  endDate: "2026-09-28T00:00:00.000Z",
  timezone: "UTC",
  reviewStatus: null,
  reviewAvailable: false,
  weeklyReview: null,
  workouts: [],
};

const calendarWorkout = {
  id: "workout-1",
  cycleId: "cycle-1",
  activityType: "STRENGTH" as const,
  scheduledDate: "2026-09-15T09:00:00.000Z",
  durationMinutes: 60,
  status: "PLANNED" as const,
  completedAt: null,
  rescheduleCount: 0,
};

const detailedWorkout: ApiWorkout = {
  ...calendarWorkout,
  plannedExercises: [
    {
      exerciseId: "bench",
      sortOrder: 1,
      restSeconds: 120,
      plannedSets: [
        {
          setNumber: 1,
          targetReps: 8,
          plannedWeight: 60,
          weightUnit: "KG",
        },
      ],
    },
  ],
};

function renderCalendar() {
  return render(
    <MemoryRouter initialEntries={["/calendar?month=2026-09"]}>
      <Routes>
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/workouts/:workoutId" element={<h1>Workout destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getCurrentCycle).mockResolvedValue(activeCycle);
  vi.mocked(api.getCalendarWorkouts).mockResolvedValue([calendarWorkout]);
  vi.mocked(api.getWorkout).mockResolvedValue(detailedWorkout);
  vi.mocked(api.listExercises).mockResolvedValue([
    { id: "bench", name: "Bench Press", equipment: "BARBELL" },
  ]);
});

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

  it("marks each activity type for semantic calendar styling", () => {
    render(
      <div>
        <WorkoutCard
          workout={plannedWorkout}
          onSelect={vi.fn()}
        />
        <WorkoutCard
          workout={{ ...plannedWorkout, id: "cardio-1", activityType: "CARDIO" }}
          onSelect={vi.fn()}
        />
        <WorkoutCard
          workout={{ ...plannedWorkout, id: "sport-1", activityType: "SPORT" }}
          onSelect={vi.fn()}
        />
      </div>,
    );

    expect(screen.getByRole("button", { name: /strength workout/i })).toHaveAttribute(
      "data-activity",
      "strength",
    );
    expect(screen.getByRole("button", { name: /cardio workout/i })).toHaveAttribute(
      "data-activity",
      "cardio",
    );
    expect(screen.getByRole("button", { name: /sport workout/i })).toHaveAttribute(
      "data-activity",
      "sport",
    );
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

  it("opens workout details and links to the authoritative workout page", async () => {
    const user = userEvent.setup();
    renderCalendar();

    await user.click(
      await screen.findByRole("button", { name: /strength workout/i }),
    );

    expect(
      await screen.findByRole("heading", { name: /workout details/i }),
    ).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByText("60 min")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /start workout/i }),
    ).toHaveAttribute("href", "/workouts/workout-1");
    expect(api.getWorkout).toHaveBeenCalledWith("workout-1");
    expect(screen.getByText("Bench Press")).toBeInTheDocument();
  });

  it("closes the workout details drawer without changing the calendar selection", async () => {
    const user = userEvent.setup();
    renderCalendar();

    await user.click(
      await screen.findByRole("button", { name: /strength workout/i }),
    );
    await screen.findByRole("dialog");

    await user.click(
      screen.getByRole("button", { name: /close workout details/i }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /strength workout/i }),
    ).toBeInTheDocument();
  });

  it("closes the details drawer with Escape and restores focus to the event", async () => {
    const user = userEvent.setup();
    renderCalendar();

    const event = await screen.findByRole("button", { name: /strength workout/i });
    await user.click(event);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(event).toHaveFocus();
  });

  it.each([
    ["COMPLETED" as const, "Completed workout history"],
    ["CANCELLED" as const, "Cancelled workout history"],
  ])("shows %s status copy in the details drawer", async (status, copy) => {
    const user = userEvent.setup();
    vi.mocked(api.getCalendarWorkouts).mockImplementation(async () => [
      { ...calendarWorkout, status },
    ]);
    vi.mocked(api.getWorkout).mockResolvedValueOnce({
      ...detailedWorkout,
      status,
      completedAt: status === "COMPLETED" ? "2026-09-15T10:00:00.000Z" : null,
    });
    renderCalendar();

    await user.click(
      await screen.findByRole("button", { name: /strength workout/i }),
    );

    expect(await screen.findByText(copy)).toBeInTheDocument();
  });

  it("shows a recoverable detail error when the selected workout cannot be loaded", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getWorkout).mockRejectedValueOnce(
      new Error("Workout details unavailable"),
    );
    renderCalendar();

    await user.click(
      await screen.findByRole("button", { name: /strength workout/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Workout details unavailable",
    );
  });

  it("clears the selected drawer when the next month has no selected workout", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getCalendarWorkouts)
      .mockResolvedValueOnce([calendarWorkout])
      .mockResolvedValue([]);
    renderCalendar();

    await user.click(
      await screen.findByRole("button", { name: /strength workout/i }),
    );
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: /next month/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
