import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfilePage } from "../../src/pages/profile/ProfilePage";
import * as api from "../../src/api/client";

vi.mock("../../src/api/client", () => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const profile = {
  weeklyTrainingDays: 4,
  sessionDurationMinutes: 60,
  defaultLocation: "GYM" as const,
  primaryGoal: "FAT_LOSS",
  secondaryOutcome: "MUSCLE_PRESERVATION",
  gender: "MALE" as const,
  age: 30,
  heightCm: 180,
  weightKg: 80,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/profile"]}>
      <Routes>
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("profile page", () => {
  it("loads profile values and saves an edited profile", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getProfile).mockResolvedValue(profile);
    vi.mocked(api.saveProfile).mockResolvedValue({ ...profile, age: 31 });

    renderPage();

    const age = await screen.findByLabelText(/^Age/);
    await user.clear(age);
    await user.type(age, "31");
    await user.click(screen.getByRole("button", { name: /save profile/i }));

    expect(api.saveProfile).toHaveBeenCalledWith({ ...profile, age: 31 });
    expect(await screen.findByRole("status")).toHaveTextContent(/saved/i);
  });

  it("keeps invalid profile input client-side and does not submit it", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getProfile).mockResolvedValue(profile);

    renderPage();

    const age = await screen.findByLabelText(/^Age/);
    await user.clear(age);
    await user.type(age, "12");
    await user.click(screen.getByRole("button", { name: /save profile/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(api.saveProfile).not.toHaveBeenCalled();
  });
});
