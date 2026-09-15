import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ProgressPage } from "../../src/pages/progress/ProgressPage";
import { buildProgressSummary } from "../../src/features/progress/progress-model";
import * as api from "../../src/api/client";
import type { ApiCycle } from "../../src/api/contracts";

vi.mock("../../src/api/client", () => ({
  getCurrentCycle: vi.fn(),
}));

function cycle(overrides: Partial<ApiCycle> = {}): ApiCycle {
  return {
    id: "cycle-1",
    status: "ACTIVE",
    cycleNumber: 1,
    startDate: "2026-09-01T00:00:00.000Z",
    endDate: "2026-09-28T00:00:00.000Z",
    timezone: "UTC",
    reviewStatus: null,
    reviewAvailable: false,
    batchReviewStatus: null,
    workouts: [],
    ...overrides,
  };
}

describe("progress model", () => {
  it("keeps zero-workout progress at zero instead of dividing by zero", () => {
    const result = buildProgressSummary([]);

    expect(result.completionRate).toBe(0);
    expect(result.totalSessions).toBe(0);
    expect(result.activityTotals.cardio.actualDistanceKm).toBe(0);
  });
});

describe("progress page", () => {
  it("shows actual activity totals and exposes review only when the server requires it", async () => {
    vi.mocked(api.getCurrentCycle).mockResolvedValue(
      cycle({
        reviewStatus: { reviewRequired: true, reason: "PAST_END_DATE", today: new Date() },
        workouts: [
          {
            id: "workout-1",
            activityType: "CARDIO",
            scheduledDate: "2026-09-03T00:00:00.000Z",
            location: "GYM",
            durationMinutes: 30,
            status: "COMPLETED",
            cancellationReason: null,
            completedAt: "2026-09-03T18:00:00.000Z",
            rescheduleCount: 1,
            actualDetails: { actualDurationMinutes: 35, distanceKm: 5.2 },
          },
        ],
      }),
    );

    render(
      <MemoryRouter initialEntries={["/progress"]}>
        <Routes>
          <Route path="/progress" element={<ProgressPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Progress")).toBeInTheDocument();
    expect(screen.getByText("5.2 km")).toBeInTheDocument();
    expect(screen.getByText("35 min")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review cycle/i })).toHaveAttribute(
      "href",
      "/review/cycle-1",
    );
  });
});
