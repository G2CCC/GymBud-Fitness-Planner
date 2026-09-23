import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentCycle } from "../../src/api/client";
import { LandingPage } from "../../src/pages/landing/LandingPage";

vi.mock("../../src/api/client", () => ({
  getCurrentCycle: vi.fn(),
}));

describe("LandingPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the public product message and registration calls to action", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: /train with intention/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start planning/i })).toHaveAttribute(
      "href",
      "/signup",
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(
      screen.getByRole("heading", { name: "Plan. Schedule. Train. Review." }),
    ).toBeInTheDocument();
  });

  it("does not request protected cycle data", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(vi.mocked(getCurrentCycle)).not.toHaveBeenCalled();
  });

  it("uses the monthly Calendar as the product preview", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.getByText("September 2026")).toBeInTheDocument();
    expect(screen.getAllByText("Strength").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cardio").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sport").length).toBeGreaterThan(0);
    expect(screen.queryByText("Today")).not.toBeInTheDocument();
  });
});
