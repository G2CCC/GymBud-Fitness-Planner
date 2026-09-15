import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../../src/auth/AuthProvider";
import type { AuthContextValue } from "../../src/auth/auth-types";
import { App } from "../../src/App";
import { RequireAuth } from "../../src/components/auth/RequireAuth";
import { AuthPage } from "../../src/pages/auth/AuthPage";
import { LandingRoute } from "../../src/router";
import { TodayPage } from "../../src/pages/today/TodayPage";

const unauthenticatedAuthContext: AuthContextValue = {
  state: { status: "unauthenticated", session: null },
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
};

const authenticatedAuthContext: AuthContextValue = {
  state: {
    status: "authenticated",
    session: {} as NonNullable<AuthContextValue["state"]["session"]>,
  },
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
};

afterEach(() => {
  cleanup();
});

describe("authentication routes", () => {
  it("redirects an unauthenticated protected route to login", async () => {
    render(
      <MemoryRouter initialEntries={["/today"]}>
        <AuthContext.Provider value={unauthenticatedAuthContext}>
          <Routes>
            <Route
              element={
                <RequireAuth>
                  <TodayPage />
                </RequireAuth>
              }
              path="/today"
            />
            <Route element={<AuthPage mode="login" />} path="/login" />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it("redirects an authenticated root route to Today", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthContext.Provider value={authenticatedAuthContext}>
          <Routes>
            <Route element={<LandingRoute />} path="/" />
            <Route element={<h1>Today</h1>} path="/today" />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Today" })).toBeInTheDocument();
  });

  it("submits login credentials and navigates to Today", async () => {
    const user = userEvent.setup();
    const signIn = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <AuthContext.Provider
          value={{ ...unauthenticatedAuthContext, signIn }}
        >
          <Routes>
            <Route element={<AuthPage mode="login" />} path="/login" />
            <Route element={<h1>Today</h1>} path="/today" />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(signIn).toHaveBeenCalledWith("person@example.com", "password");
    expect(await screen.findByRole("heading", { name: "Today" })).toBeInTheDocument();
  });

  it("shows email confirmation after a sign-up without a session", async () => {
    const user = userEvent.setup();
    const signUp = vi.fn().mockResolvedValue({ confirmationRequired: true });

    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <AuthContext.Provider
          value={{ ...unauthenticatedAuthContext, signUp }}
        >
          <Routes>
            <Route element={<AuthPage mode="signup" />} path="/signup" />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(signUp).toHaveBeenCalledWith("person@example.com", "password");
    expect(
      await screen.findByRole("status"),
    ).toHaveTextContent(/check your email/i);
  });

  it("signs out from the protected app shell and returns to the public route", async () => {
    const user = userEvent.setup();
    const signOut = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={["/today"]}>
        <AuthContext.Provider
          value={{ ...authenticatedAuthContext, signOut }}
        >
          <Routes>
            <Route element={<App />} path="/today" />
            <Route element={<h1>Landing</h1>} path="/" />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    await user.click(screen.getAllByRole("button", { name: "Sign out" })[0]!);

    expect(signOut).toHaveBeenCalledOnce();
    expect(await screen.findByRole("heading", { name: "Landing" })).toBeInTheDocument();
  });
});
