import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileForm } from "../../src/components/onboarding/ProfileForm";
import { OnboardingPage } from "../../src/pages/onboarding/OnboardingPage";
import * as api from "../../src/api/client";
import type { ApiPlanDraft } from "../../src/api/contracts";

vi.mock("../../src/api/client", () => ({
  activateCycle: vi.fn(),
  confirmInitialCyclePlan: vi.fn(),
  createCycleDraft: vi.fn(),
  generateInitialCyclePlan: vi.fn(),
  getCurrentCycle: vi.fn(),
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
}));

const planDraft: ApiPlanDraft = {
  cycleId: "draft-1",
  model: "fake-model",
  promptVersion: "v1",
  workouts: [
    {
      scheduledDate: "2026-09-15T00:00:00.000Z",
      activityType: "CARDIO",
      durationMinutes: 30,
      exercises: [],
    },
  ],
};

function renderOnboarding() {
  return render(
    <MemoryRouter initialEntries={["/onboarding"]}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/calendar" element={<p>Calendar reached</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getProfile).mockResolvedValue(null);
  vi.mocked(api.getCurrentCycle).mockResolvedValue(null);
  vi.mocked(api.saveProfile).mockResolvedValue({
    weeklyTrainingDays: 3,
    sessionDurationMinutes: 60,
    primaryGoal: "FAT_LOSS",
    gender: "FEMALE",
    age: 27,
    heightCm: 178,
    weightKg: 82,
  });
  vi.mocked(api.createCycleDraft).mockResolvedValue({
    id: "draft-1",
    status: "DRAFT",
    startDate: "2026-09-15T00:00:00.000Z",
    endDate: "2026-10-12T00:00:00.000Z",
    timezone: "Pacific/Auckland",
  });
  vi.mocked(api.activateCycle).mockResolvedValue({
    id: "cycle-1",
    status: "ACTIVE",
    cycleNumber: 1,
    startDate: "2026-09-15T00:00:00.000Z",
    endDate: "2026-10-12T00:00:00.000Z",
    timezone: "Pacific/Auckland",
    firstWeekDates: [],
  });
  vi.mocked(api.generateInitialCyclePlan).mockResolvedValue(planDraft);
  vi.mocked(api.confirmInitialCyclePlan).mockResolvedValue({});
});

afterEach(() => {
  cleanup();
});

async function saveProfileAndReachChoice(user: ReturnType<typeof userEvent.setup>) {
  renderOnboarding();
  await screen.findByLabelText(/gender/i);
  await user.selectOptions(screen.getByLabelText(/gender/i), "MALE");
  await user.type(screen.getByLabelText(/^Age/i), "30");
  await user.type(screen.getByLabelText(/Height \(cm\)/i), "180");
  await user.type(screen.getByLabelText(/Body weight \(kg\)/i), "80");
  await user.click(
    await screen.findByRole("button", { name: /save and open calendar/i }),
  );
  expect(
    await screen.findByRole("heading", { name: /how do you want to start/i }),
  ).toBeInTheDocument();
}

describe("onboarding profile form", () => {
  it("submits the required body context with the training profile", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<ProfileForm onSubmit={onSubmit} />);

    await user.selectOptions(screen.getByLabelText(/gender/i), "FEMALE");
    await user.type(screen.getByLabelText(/^Age/i), "27");
    await user.type(screen.getByLabelText(/Height \(cm\)/i), "178");
    await user.type(screen.getByLabelText(/Body weight \(kg\)/i), "82");
    await user.click(
      screen.getByRole("button", { name: /save and open calendar/i }),
    );

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        gender: "FEMALE",
        age: 27,
        heightCm: 178,
        weightKg: 82,
      }),
    );
  });
});

describe("onboarding plan choice", () => {
  it("asks whether the user already has a plan after saving the profile", async () => {
    const user = userEvent.setup();

    await saveProfileAndReachChoice(user);

    expect(
      screen.getByRole("button", { name: /i already have my own plan/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate a plan with ai/i }),
    ).toBeInTheDocument();
  });

  it("activates an empty cycle for a user who will add a plan manually", async () => {
    const user = userEvent.setup();

    await saveProfileAndReachChoice(user);
    await user.click(
      screen.getByRole("button", { name: /i already have my own plan/i }),
    );

    expect(api.activateCycle).toHaveBeenCalledWith(
      "draft-1",
      expect.any(String),
    );
    expect(api.generateInitialCyclePlan).not.toHaveBeenCalled();
    expect(await screen.findByText("Calendar reached")).toBeInTheDocument();
  });

  it("keeps an AI plan unconfirmed until the user explicitly confirms it", async () => {
    const user = userEvent.setup();

    await saveProfileAndReachChoice(user);
    await user.click(
      screen.getByRole("button", { name: /generate a plan with ai/i }),
    );

    expect(await screen.findByText(/ai plan ready for review/i)).toBeInTheDocument();
    expect(api.confirmInitialCyclePlan).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: /confirm and add ai plan/i }),
    );

    expect(api.confirmInitialCyclePlan).toHaveBeenCalledWith("draft-1", planDraft);
    expect(await screen.findByText("Calendar reached")).toBeInTheDocument();
  });

  it("shows an actionable error when AI plan generation fails", async () => {
    const user = userEvent.setup();
    vi.mocked(api.generateInitialCyclePlan).mockRejectedValue(
      new Error("AI provider unavailable"),
    );

    await saveProfileAndReachChoice(user);
    await user.click(
      screen.getByRole("button", { name: /generate a plan with ai/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "AI provider unavailable",
    );
  });
});
