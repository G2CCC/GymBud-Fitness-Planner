import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, it, expect, vi } from "vitest";
import type { NutritionDayDto } from "@fitness/shared";
import { NutritionPage } from "../../src/pages/nutrition/NutritionPage";
import * as api from "../../src/api/nutrition";
import { ApiRequestError } from "../../src/api/client";
vi.mock("../../src/api/nutrition", () => ({
  getNutritionDay: vi.fn(),
  searchFoods: vi.fn(),
  getFood: vi.fn(),
  addFoodEntry: vi.fn(),
  updateFoodEntry: vi.fn(),
  deleteFoodEntry: vi.fn(),
  setNutritionDayCompletion: vi.fn(),
}));
vi.mock("../../src/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/api/client")>()),
  getProfile: vi.fn().mockResolvedValue({ recordingTimezone: "UTC" }),
}));
const day: NutritionDayDto = {
  date: "2026-09-27",
  timezone: "UTC",
  revision: 0,
  completedAt: null,
  target: {
    kcal: 1939,
    proteinG: 144,
    carbsG: 195.3,
    fatG: 64.6,
    algorithmVersion: "nutrition-v1",
  },
  entries: [],
  food: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  exercise: { estimatedKcal: 0, coverage: "COMPLETE", workouts: [] },
  netKcal: 0,
  remainingKcal: 1939,
  recorded: false,
};
beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.mocked(api.getNutritionDay).mockResolvedValue(day);
  vi.mocked(api.searchFoods).mockResolvedValue({
    items: [
      {
        id: "egg",
        name: "Egg raw",
        per100g: { kcal: 100, proteinG: 10, carbsG: 2, fatG: 5 },
        portions: [{ id: "large", label: "large", unitGrams: 50 }],
      },
    ],
    nextCursor: null,
  });
});
function renderPage() {
  render(
    <MemoryRouter>
      <NutritionPage />
    </MemoryRouter>,
  );
}
it("shows four meals, keeps date strings, and saves fractional verified each portions", async () => {
  const user = userEvent.setup();
  renderPage();
  expect(await screen.findByText("Not recorded")).toBeVisible();
  for (const meal of ["Breakfast", "Lunch", "Dinner", "Snack"])
    expect(screen.getByRole("heading", { name: meal })).toBeVisible();
  await user.clear(screen.getByLabelText("Diary date"));
  await user.type(screen.getByLabelText("Diary date"), "2026-09-27");
  await user.click(screen.getByRole("button", { name: "Add to Breakfast" }));
  await user.click(await screen.findByRole("button", { name: "Egg raw" }));
  await user.selectOptions(screen.getByLabelText("Unit"), "ea");
  expect(screen.getByText(/1 ea = 50 g/)).toBeVisible();
  await user.clear(screen.getByLabelText("Quantity"));
  await user.type(screen.getByLabelText("Quantity"), "1.5");
  await user.click(screen.getByRole("button", { name: "Save food" }));
  await waitFor(() =>
    expect(api.addFoodEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-09-27",
        unit: "ea",
        quantity: 1.5,
        portionId: "large",
      }),
    ),
  );
});
it("preserves unsaved inputs and request ID after a revision conflict", async () => {
  const user = userEvent.setup();
  vi.mocked(api.addFoodEntry)
    .mockRejectedValueOnce(
      new ApiRequestError("Changed", 409, "REVISION_CONFLICT"),
    )
    .mockResolvedValueOnce({} as never);
  renderPage();
  await screen.findByText("Not recorded");
  await user.click(screen.getByRole("button", { name: "Add to Lunch" }));
  await user.click(await screen.findByRole("button", { name: "Egg raw" }));
  await user.clear(screen.getByLabelText("Quantity"));
  await user.type(screen.getByLabelText("Quantity"), "42");
  vi.mocked(api.getNutritionDay).mockResolvedValue({ ...day, revision: 4 });
  await user.click(screen.getByRole("button", { name: "Save food" }));
  expect(await screen.findByText(/Day refreshed/)).toBeVisible();
  expect(screen.getByLabelText("Quantity")).toHaveValue(42);
  const first = vi.mocked(api.addFoodEntry).mock.calls[0][0];
  await user.click(screen.getByRole("button", { name: "Save food" }));
  await waitFor(() =>
    expect(api.addFoodEntry).toHaveBeenLastCalledWith({
      ...first,
      expectedRevision: 4,
    }),
  );
});
it("labels partial estimates and exceeded target, without claiming success", async () => {
  vi.mocked(api.getNutritionDay).mockResolvedValue({
    ...day,
    recorded: true,
    netKcal: 2100,
    remainingKcal: -161,
    exercise: { estimatedKcal: 300, coverage: "PARTIAL", workouts: [] },
  });
  renderPage();
  expect(await screen.findByText(/Exceeded by 161/)).toBeVisible();
  expect(screen.getByText(/Known exercise subtotal/)).toBeVisible();
  expect(screen.queryByText("Target achieved")).not.toBeInTheDocument();
});
