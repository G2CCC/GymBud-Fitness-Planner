import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StrengthLogForm } from "../../src/components/workouts/StrengthLogForm";
import { WorkoutPage } from "../../src/pages/workouts/WorkoutPage";
import * as api from "../../src/api/client";
import type {
  ApiPlannedExercise,
  ApiWorkout,
} from "../../src/api/contracts";
import type { StrengthWorkoutLogInput } from "@fitness/shared";

vi.mock("../../src/api/client", () => ({
  completeWorkout: vi.fn(),
  getWorkout: vi.fn(),
  listExercises: vi.fn(),
  updateWorkoutLocation: vi.fn(),
}));

const plannedExercises: ApiPlannedExercise[] = [
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
];

const plannedWorkout: ApiWorkout = {
  id: "workout-1",
  activityType: "STRENGTH",
  scheduledDate: "2026-09-15T09:00:00.000Z",
  location: "GYM",
  durationMinutes: 60,
  status: "PLANNED",
  cancellationReason: null,
  completedAt: null,
  rescheduleCount: 0,
  plannedExercises,
};

const completedWorkout: ApiWorkout = {
  ...plannedWorkout,
  status: "COMPLETED",
  completedAt: "2026-09-15T10:00:00.000Z",
};

function renderWorkoutPage() {
  return render(
    <MemoryRouter initialEntries={["/workouts/workout-1"]}>
      <Routes>
        <Route path="/workouts/:workoutId" element={<WorkoutPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.mocked(api.getWorkout).mockResolvedValue(plannedWorkout);
  vi.mocked(api.listExercises).mockResolvedValue([
    {
      id: "bench",
      name: "Bench Press",
      equipment: "BARBELL",
      availableLocations: ["GYM"],
    },
  ]);
  vi.mocked(api.updateWorkoutLocation).mockResolvedValue(plannedWorkout);
  vi.mocked(api.completeWorkout).mockResolvedValue(completedWorkout);
});

describe("strength log form", () => {
  it("shows read-only planned targets beside editable actual values", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    function Harness() {
      const [value, setValue] = useState<StrengthWorkoutLogInput>({
        exercises: [
          {
            exerciseId: "bench",
            sortOrder: 1,
            sets: [{ setNumber: 1, reps: 8, weight: 60, weightUnit: "KG" }],
          },
        ],
      });

      return (
        <StrengthLogForm
          value={value}
          plannedExercises={plannedExercises}
          exerciseNames={{ bench: "Bench Press" }}
          onChange={(nextValue) => {
            setValue(nextValue);
            onChange(nextValue);
          }}
        />
      );
    }

    render(<Harness />);

    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    expect(screen.getByText(/Target: 8 reps · 60 kg/i)).toBeInTheDocument();

    const reps = screen.getByRole("spinbutton", {
      name: /actual reps.*bench press.*set 1/i,
    });
    await user.clear(reps);
    await user.type(reps, "7");

    expect(onChange).toHaveBeenLastCalledWith({
      exercises: [
        {
          exerciseId: "bench",
          sortOrder: 1,
          sets: [{ setNumber: 1, reps: 7, weight: 60, weightUnit: "KG" }],
        },
      ],
    });
  });
});

describe("workout detail and logging", () => {
  it("requires a real completion date and time in the backfill flow", async () => {
    const user = userEvent.setup();
    renderWorkoutPage();

    await screen.findByRole("heading", { name: /log your workout/i });
    await user.click(
      screen.getByRole("button", { name: /backfill a completed session/i }),
    );
    await user.click(screen.getByRole("button", { name: /save completion/i }));

    expect(
      screen.getByText("Completion date and time are required."),
    ).toBeInTheDocument();
    expect(api.completeWorkout).not.toHaveBeenCalled();
  });

  it("keeps actual values separate and completes the workout", async () => {
    const user = userEvent.setup();
    renderWorkoutPage();

    const reps = await screen.findByRole("spinbutton", {
      name: /actual reps.*bench press.*set 1/i,
    });
    await user.clear(reps);
    await user.type(reps, "7");
    await user.click(screen.getByRole("button", { name: /save workout/i }));

    expect(api.completeWorkout).toHaveBeenCalledWith("workout-1", {
      log: {
        exercises: [
          {
            exerciseId: "bench",
            sortOrder: 1,
            sets: [{ setNumber: 1, reps: 7, weight: 60, weightUnit: "KG" }],
          },
        ],
      },
    });
    expect(
      await screen.findByText("Workout completed and log saved."),
    ).toBeInTheDocument();
  });

  it("prevents duplicate submissions while the server request is pending", async () => {
    const user = userEvent.setup();
    let resolveRequest: (value: ApiWorkout) => void = () => undefined;
    vi.mocked(api.completeWorkout).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    renderWorkoutPage();

    const submit = await screen.findByRole("button", { name: /save workout/i });
    await user.click(submit);

    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
    expect(api.completeWorkout).toHaveBeenCalledTimes(1);

    resolveRequest(completedWorkout);
  });

  it("keeps the edited form after a recoverable server error", async () => {
    const user = userEvent.setup();
    vi.mocked(api.completeWorkout)
      .mockRejectedValueOnce(new Error("Temporary server error"))
      .mockResolvedValueOnce(completedWorkout);
    renderWorkoutPage();

    const reps = await screen.findByRole("spinbutton", {
      name: /actual reps.*bench press.*set 1/i,
    });
    await user.clear(reps);
    await user.type(reps, "6");
    await user.click(screen.getByRole("button", { name: /save workout/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Temporary server error",
    );
    expect(reps).toHaveValue(6);

    await user.click(screen.getByRole("button", { name: /save workout/i }));
    expect(api.completeWorkout).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByText("Workout completed and log saved."),
    ).toBeInTheDocument();
  });
});
