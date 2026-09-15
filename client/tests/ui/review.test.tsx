import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { NextCycleDraftEditor } from "../../src/components/review/NextCycleDraftEditor";
import { ReviewPage } from "../../src/pages/review/ReviewPage";
import * as api from "../../src/api/client";
import type { ApiCycleReviewResult } from "../../src/api/contracts";

vi.mock("../../src/api/client", () => ({
  confirmNextCyclePlan: vi.fn(),
  generateBatchReview: vi.fn(),
  generateCycleReview: vi.fn(),
  generateNextCycleDraft: vi.fn(),
  getBatchReviewStatus: vi.fn(),
}));

const reviewResult: ApiCycleReviewResult = {
  reviewId: "review-4",
  cycleId: "cycle-4",
  cycleNumber: 4,
  cycleStatus: "CLOSED",
  trainingVolume: { completedWorkoutCount: 3 },
  objectiveSummary: { completedWorkoutCount: 3 },
  previousCycle: null,
  processedSummary: "Recorded volume was consistent.",
  conclusions: {
    status: "CONTINUE",
    keyFindings: ["Three completed sessions."],
    recommendations: ["Continue progressively."],
  },
  nextCycleEligibility: "BATCH_REVIEW_REQUIRED",
  nextCycleDraftStatus: "NOT_AVAILABLE",
  batchReview: {
    eligible: true,
    reviewId: "batch-1-4",
    status: "ELIGIBLE",
  },
};

describe("next-cycle draft editor", () => {
  it("keeps the AI draft unconfirmed until the user explicitly confirms it", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <NextCycleDraftEditor
        draft={{
          cycleId: "draft-1",
          title: "Strength foundation",
          focus: "Build consistent strength",
          weeks: 4,
        }}
        onConfirm={onConfirm}
      />,
    );

    expect(onConfirm).not.toHaveBeenCalled();
    expect(
      screen.getByText("Review the AI draft before adding it to your calendar."),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /confirm and add to calendar/i }),
    );

    expect(onConfirm).toHaveBeenCalledWith({
      cycleId: "draft-1",
      title: "Strength foundation",
      focus: "Build consistent strength",
      weeks: 4,
    });
  });
});

describe("cycle review page", () => {
  it("does not request a next plan immediately after a single-cycle review", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getBatchReviewStatus).mockResolvedValue({
      eligible: false,
      reviewId: null,
      startCycleNumber: null,
      endCycleNumber: null,
      status: "NOT_ELIGIBLE",
    });
    vi.mocked(api.generateCycleReview).mockResolvedValue(reviewResult);

    render(
      <MemoryRouter initialEntries={["/review/cycle-4"]}>
        <Routes>
          <Route path="/review/:cycleId" element={<ReviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: /generate cycle review/i }),
    );

    expect(await screen.findByText("Recorded volume was consistent.")).toBeInTheDocument();
    expect(api.generateNextCycleDraft).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /review these four cycles/i }),
    ).toBeInTheDocument();
  });
});
