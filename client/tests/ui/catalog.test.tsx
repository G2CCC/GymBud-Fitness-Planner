import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActivityIconKey } from "@fitness/shared";
import * as api from "../../src/api/client";
import type { ApiActivityOption } from "../../src/api/contracts";
import { ActivityIcon } from "../../src/components/catalog/ActivityIcon";
import { ActivityOptionPicker } from "../../src/components/catalog/ActivityOptionPicker";
import { AddSessionPanel } from "../../src/components/calendar/AddSessionPanel";
import { ExercisePicker } from "../../src/components/exercises/ExercisePicker";
import { CardioLogForm } from "../../src/components/workouts/CardioLogForm";
import { SportLogForm } from "../../src/components/workouts/SportLogForm";

vi.mock("../../src/api/client", () => ({
  createWorkout: vi.fn(),
  listActivityOptions: vi.fn(),
  listExercises: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const stationaryBikeOption: ApiActivityOption = {
  id: "cardio-stationary-bike",
  activityType: "CARDIO",
  name: "Stationary Bike",
  iconKey: "BIKE",
  aiEligible: true,
  sortOrder: 40,
  description: "Indoor cycling",
};

describe("catalog UI", () => {
  it("renders a mapped icon and falls back for unknown keys", () => {
    const { rerender } = render(
      <ActivityIcon iconKey="BIKE" label="Stationary Bike" />,
    );
    expect(screen.getByLabelText("Stationary Bike")).toBeInTheDocument();

    rerender(
      <ActivityIcon
        iconKey={"UNKNOWN" as ActivityIconKey}
        label="Fallback"
      />,
    );
    expect(screen.getByLabelText("Fallback")).toBeInTheDocument();
  });

  it("selects an activity option with an accessible pressed state", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ActivityOptionPicker
        options={[stationaryBikeOption]}
        value=""
        onChange={onChange}
      />,
    );

    const button = screen.getByRole("button", { name: /stationary bike/i });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await user.click(button);
    expect(onChange).toHaveBeenCalledWith("cardio-stationary-bike");
  });

  it("shows exercise thumbnails and a neutral fallback when an image is absent", () => {
    render(
      <ExercisePicker
        exercises={[
          {
            id: "bench",
            name: "Bench Press",
            equipment: "BARBELL",
            focusAreas: ["CHEST"],
            imageUrl: "https://example.com/bench.jpg",
          },
          {
            id: "push-up",
            name: "Push Up",
            equipment: "NONE",
            focusAreas: ["CHEST"],
            imageUrl: null,
          },
        ]}
        value="push-up"
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("img", { name: /push up image unavailable/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /bench press/i })).toBeInTheDocument();
  });

  it("shows catalog names in cardio and sport logs", () => {
    render(
      <div>
        <CardioLogForm
          value={{ actualDurationMinutes: 30 }}
          activityOption={stationaryBikeOption}
          onChange={vi.fn()}
        />
        <SportLogForm
          value={{ actualDurationMinutes: 45 }}
          activityOption={{
            id: "sport-basketball",
            activityType: "SPORT",
            name: "Basketball",
            iconKey: "CIRCLE_DOT",
            aiEligible: true,
            sortOrder: 10,
            description: null,
          }}
          onChange={vi.fn()}
        />
      </div>,
    );

    expect(screen.getByText("Stationary Bike")).toBeInTheDocument();
    expect(screen.getByLabelText("Stationary Bike")).toBeInTheDocument();
    expect(screen.getByText("Basketball")).toBeInTheDocument();
  });

  it("requires and submits a catalog option for a cardio session", async () => {
    const user = userEvent.setup();
    vi.mocked(api.listActivityOptions).mockResolvedValue([stationaryBikeOption]);
    vi.mocked(api.listExercises).mockResolvedValue([]);
    vi.mocked(api.createWorkout).mockResolvedValue({
      id: "workout-1",
      activityType: "CARDIO",
      scheduledDate: "2026-09-25T00:00:00.000Z",
      durationMinutes: 60,
      status: "PLANNED",
      completedAt: null,
      rescheduleCount: 0,
      activityOption: stationaryBikeOption,
    });

    render(
      <AddSessionPanel
        onClose={vi.fn()}
        onCreated={vi.fn()}
        onMessage={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Activity"), "CARDIO");
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /stationary bike/i }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /stationary bike/i }));
    await user.click(screen.getByRole("button", { name: /add workout/i }));

    await waitFor(() => {
      expect(api.createWorkout).toHaveBeenCalledWith(
        expect.objectContaining({
          activityType: "CARDIO",
          activityOptionId: "cardio-stationary-bike",
        }),
      );
    });
  });
});
