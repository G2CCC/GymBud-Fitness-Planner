import { render, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import { buildNutritionSummary } from "@fitness/shared";
import { NutritionReview } from "../../src/components/nutrition/NutritionReview";
it("shows frozen date, explicit coverage and no-sample values", () => {
  const summary = buildNutritionSummary(
    [],
    { startDate: "2026-09-21", endDate: "2026-09-27" },
    "2026-09-28T12:00:00Z",
  );
  render(
    <NutritionReview
      summary={summary}
      comparison={null}
      review={{
        status: "INSUFFICIENT_DATA",
        observations: ["Not enough recorded days."],
        suggestions: ["Confirm finished diary days."],
      }}
    />,
  );
  expect(screen.getByText(/0 of 7 days complete/)).toBeVisible();
  expect(screen.getByText(/2026-09-28T12:00:00Z/)).toBeVisible();
  expect(screen.getAllByText("No valid samples").length).toBeGreaterThan(0);
  expect(screen.getByText("Confirm finished diary days.")).toBeVisible();
});
