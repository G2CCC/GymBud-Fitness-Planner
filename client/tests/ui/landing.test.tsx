import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentCycle } from "../../src/api/client";
import { LandingPage } from "../../src/pages/landing/LandingPage";

vi.mock("../../src/api/client", () => ({
  getCurrentCycle: vi.fn(),
}));

describe("LandingPage", () => {
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
});
