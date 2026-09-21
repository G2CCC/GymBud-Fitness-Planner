import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ReviewPage } from "../../src/pages/review/ReviewPage";
import * as api from "../../src/api/client";
import type { ApiCycleReviewResult } from "../../src/api/contracts";

vi.mock("../../src/api/client", () => ({
  confirmNextCyclePlan: vi.fn(),
  generateNextCycleDraft: vi.fn(),
  processWeeklyReview: vi.fn(),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const review: ApiCycleReviewResult = {
  reviewId: "review-1", cycleId: "cycle-1", cycleNumber: 1, cycleStatus: "CLOSED",
  trainingVolume: { completedWorkoutCount: 3 }, previousCycle: null,
  processedSummary: "Recorded weekly volume was consistent.",
  conclusions: { status: "CONTINUE", keyFindings: ["Three sessions."], recommendations: ["Continue progressively."] },
  nextCycleEligibility: "READY", nextWeeklyDraftStatus: "PENDING", nextWeeklyDraft: null,
};

describe("weekly review page", () => {
  it("loads the automatic review without a summary input or batch controls", async () => {
    vi.mocked(api.processWeeklyReview).mockResolvedValue(review);
    render(<MemoryRouter initialEntries={["/review/cycle-1"]}><Routes><Route path="/review/:cycleId" element={<ReviewPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByText("Recorded weekly volume was consistent.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/four-cycle/i)).not.toBeInTheDocument();
  });
});
