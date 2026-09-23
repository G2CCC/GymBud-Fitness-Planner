import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthContext } from "../../src/auth/AuthProvider";
import type { AuthContextValue } from "../../src/auth/auth-types";
import { App } from "../../src/App";

const authenticatedAuthContext: AuthContextValue = {
  state: {
    status: "authenticated",
    session: {} as NonNullable<AuthContextValue["state"]["session"]>,
  },
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
};

describe("primary navigation", () => {
  it("shows Calendar, Progress, and Profile without a Today destination", () => {
    render(
      <MemoryRouter initialEntries={["/calendar"]}>
        <AuthContext.Provider value={authenticatedAuthContext}>
          <App />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("link", { name: "Calendar" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Progress" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Profile" })).toHaveLength(2);
    expect(screen.queryAllByRole("link", { name: "Today" })).toHaveLength(0);
  });
});
