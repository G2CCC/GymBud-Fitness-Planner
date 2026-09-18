import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/App";
import { AuthContext } from "../../src/auth/AuthProvider";
import type { AuthContextValue } from "../../src/auth/auth-types";
import type { ApiCycle, ApiWorkout } from "../../src/api/contracts";
import * as api from "../../src/api/client";
import {
  buildTodayViewModel,
  dateKeyFromIso,
  formatDateKey,
  systemDateKey,
} from "../../src/features/today/today-model";
import { TodayPage } from "../../src/pages/today/TodayPage";
import { router } from "../../src/router";

vi.mock("../../src/api/client", () => ({
  getCurrentCycle: vi.fn(),
}));

const now = new Date("2026-09-15T12:00:00.000Z");

function cycle(overrides: Partial<ApiCycle> = {}): ApiCycle {
  return {
    id: "cycle-1",
    status: "ACTIVE",
    cycleNumber: 1,
    startDate: "2026-09-01T00:00:00.000Z",
    endDate: "2026-09-28T00:00:00.000Z",
    timezone: "Pacific/Auckland",
    reviewStatus: null,
    reviewAvailable: false,
    batchReviewStatus: null,
    workouts: [],
    ...overrides,
  };
}

function workout(
  id: string,
  scheduledDate: string,
  status: ApiWorkout["status"] = "PLANNED",
): ApiWorkout {
  return {
    id,
    activityType: "STRENGTH",
    scheduledDate,
    durationMinutes: 60,
    status,
    completedAt: status === "COMPLETED" ? scheduledDate : null,
    rescheduleCount: 0,
    plannedDetails: null,
    plannedExercises: [],
    actualDetails: null,
    actualExercises: [],
  };
}

function reviewStatus() {
  return {
    reviewRequired: true as const,
    reason: "PAST_END_DATE" as const,
    today: now,
  };
}

function persistedDate(offset = 0): string {
  const date = new Date(`${systemDateKey(now)}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return `${date.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

function renderToday() {
  return render(
    <MemoryRouter initialEntries={["/today"]}>
      <Routes>
        <Route path="/today" element={<TodayPage />} />
        <Route path="/onboarding" element={<p>Onboarding reached</p>} />
        <Route path="/calendar" element={<p>Calendar reached</p>} />
        <Route path="/review/:cycleId" element={<p>Review reached</p>} />
        <Route path="/workouts/:workoutId" element={<p>Workout reached</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(now);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("today view model", () => {
  it("returns no-cycle and draft states", () => {
    expect(buildTodayViewModel(null, now)).toEqual({ kind: "NO_CYCLE" });
    expect(
      buildTodayViewModel(cycle({ status: "DRAFT" }), now),
    ).toMatchObject({ kind: "DRAFT" });
  });

  it.each([
    ["active review status", { reviewStatus: reviewStatus() }],
    ["closed cycle review", { reviewAvailable: true }],
    [
      "eligible batch review",
      {
        batchReviewStatus: {
          eligible: true,
          reviewId: null,
          startCycleNumber: 1,
          endCycleNumber: 4,
          status: "ELIGIBLE" as const,
        },
      },
    ],
  ])("prioritizes %s over workout actions", (_label, overrides) => {
    const result = buildTodayViewModel(
      cycle({ workouts: [workout("today", "2026-09-15T00:00:00.000Z")], ...overrides }),
      now,
    );

    expect(result.kind).toBe("REVIEW_REQUIRED");
    if (result.kind === "REVIEW_REQUIRED") {
      expect(result.todayWorkouts).toHaveLength(1);
      expect(result.reviewLabel).toMatch(/review/i);
      expect(result.summary.completedSessions).toBe(0);
    }
  });

  it("names an eligible four-cycle batch when its bounds are valid", () => {
    const result = buildTodayViewModel(
      cycle({
        status: "CLOSED",
        batchReviewStatus: {
          eligible: true,
          reviewId: null,
          startCycleNumber: 5,
          endCycleNumber: 8,
          status: "ELIGIBLE",
        },
      }),
      now,
    );

    expect(result.kind).toBe("REVIEW_REQUIRED");
    if (result.kind === "REVIEW_REQUIRED") {
      expect(result.reviewLabel).toContain("5–8");
    }
  });

  it("compares persisted UTC-midnight dates by their date key", () => {
    expect(dateKeyFromIso("2026-09-15T00:00:00.000Z")).toBe("2026-09-15");
    expect(systemDateKey(now)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("keeps every workout scheduled for today visible", () => {
    const result = buildTodayViewModel(
      cycle({
        workouts: [
          workout("planned-today", "2026-09-15T00:00:00.000Z"),
          workout("completed-today", "2026-09-15T00:00:00.000Z", "COMPLETED"),
          workout("cancelled-today", "2026-09-15T00:00:00.000Z", "CANCELLED"),
        ],
      }),
      now,
    );

    expect(result.kind).toBe("READY");
    if (result.kind === "READY") {
      expect(result.todayWorkouts.map((item) => item.id)).toEqual([
        "planned-today",
        "completed-today",
        "cancelled-today",
      ]);
      expect(result.focusWorkout?.id).toBe("planned-today");
    }
  });

  it("selects the earliest future planned workout on a rest day", () => {
    const result = buildTodayViewModel(
      cycle({
        workouts: [
          workout("future-late", "2026-09-20T00:00:00.000Z"),
          workout("future-early", "2026-09-17T00:00:00.000Z"),
        ],
      }),
      now,
    );

    expect(result.kind).toBe("READY");
    if (result.kind === "READY") {
      expect(result.focusWorkout?.id).toBe("future-early");
    }
  });

  it("selects the earliest overdue planned workout when no future exists", () => {
    const result = buildTodayViewModel(
      cycle({
        workouts: [
          workout("overdue-late", "2026-09-12T00:00:00.000Z"),
          workout("overdue-early", "2026-09-10T00:00:00.000Z"),
        ],
      }),
      now,
    );

    expect(result.kind).toBe("READY");
    if (result.kind === "READY") {
      expect(result.focusWorkout?.id).toBe("overdue-early");
    }
  });

  it("has no focus workout when no planned workout exists", () => {
    const result = buildTodayViewModel(
      cycle({
        workouts: [
          workout("completed", "2026-09-15T00:00:00.000Z", "COMPLETED"),
          workout("cancelled", "2026-09-14T00:00:00.000Z", "CANCELLED"),
        ],
      }),
      now,
    );

    expect(result.kind).toBe("READY");
    if (result.kind === "READY") {
      expect(result.focusWorkout).toBeNull();
    }
  });

  it("returns a closed state when a closed cycle has no review due", () => {
    const result = buildTodayViewModel(
      cycle({ status: "CLOSED" }),
      now,
    );

    expect(result.kind).toBe("CLOSED");
  });
});

describe("today page", () => {
  it("shows loading without an empty dashboard", () => {
    vi.mocked(api.getCurrentCycle).mockReturnValue(new Promise(() => {}));

    renderToday();

    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
    expect(screen.queryByRole("link", { name: /open setup/i })).not.toBeInTheDocument();
  });

  it("shows the actual error and retries the same loader", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getCurrentCycle)
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce(null);

    renderToday();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Network unavailable",
    );
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(
      await screen.findByRole("link", { name: /open setup/i }),
    ).toHaveAttribute("href", "/onboarding");
    expect(api.getCurrentCycle).toHaveBeenCalledTimes(2);
  });

  it("leads a user without a cycle to setup", async () => {
    vi.mocked(api.getCurrentCycle).mockResolvedValue(null);

    renderToday();

    expect(await screen.findByText(/no active cycle yet/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open setup/i })).toHaveAttribute(
      "href",
      "/onboarding",
    );
    expect(screen.queryByText(/completion rate/i)).not.toBeInTheDocument();
  });

  it("sends a draft cycle back to setup", async () => {
    vi.mocked(api.getCurrentCycle).mockResolvedValue(cycle({ status: "DRAFT" }));

    renderToday();

    expect(await screen.findByText(/finish setting up/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /continue setup/i })).toHaveAttribute(
      "href",
      "/onboarding",
    );
  });

  it("gives review the primary action while retaining today's workout context", async () => {
    vi.mocked(api.getCurrentCycle).mockResolvedValue(
      cycle({
        reviewStatus: reviewStatus(),
        workouts: [workout("today", persistedDate())],
      }),
    );

    renderToday();

    expect(await screen.findByText(/review required/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review cycle/i })).toHaveAttribute(
      "href",
      "/review/cycle-1",
    );
    expect(screen.getByText(/today's workouts/i)).toBeInTheDocument();
  });

  it("shows all today's workout statuses and leaves source labels out", async () => {
    vi.mocked(api.getCurrentCycle).mockResolvedValue(
      cycle({
        workouts: [
          workout("planned-today", persistedDate()),
          workout("completed-today", persistedDate(), "COMPLETED"),
          workout("cancelled-today", persistedDate(), "CANCELLED"),
        ],
      }),
    );

    renderToday();

    expect(await screen.findByText(/today's workouts/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByText(`Today is ${formatDateKey(persistedDate())}`)).toBeInTheDocument();
    expect(screen.getAllByText(/planned/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/completed/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/cancelled/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: /view workout|start workout/i }),
    ).toHaveLength(3);
    expect(screen.queryByText(/original|manual|extra/i)).not.toBeInTheDocument();
    expect(screen.getByRole("main").className).toContain("pb-28");
    expect(screen.getByRole("main").className).toContain("lg:pb-8");
  });

  it("shows the next planned workout on a rest day", async () => {
    vi.mocked(api.getCurrentCycle).mockResolvedValue(
      cycle({ workouts: [workout("next", persistedDate(2))] }),
    );

    renderToday();

    expect(await screen.findByText(/next workout/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start workout/i })).toHaveAttribute(
      "href",
      "/workouts/next",
    );
  });

  it("shows closed cycle context and a way to start the next cycle", async () => {
    vi.mocked(api.getCurrentCycle).mockResolvedValue(
      cycle({ status: "CLOSED", cycleNumber: 4 }),
    );

    renderToday();

    expect(await screen.findByText(/cycle complete/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /start next cycle/i }),
    ).toHaveAttribute("href", "/onboarding");
  });
});

describe("today route and navigation contract", () => {
  it("keeps onboarding and exposes Today inside the protected app routes", () => {
    const childRoutes =
      router.routes.find((route) =>
        route.children?.some((child) => child.path === "today"),
      )?.children ?? [];

    expect(childRoutes.some((route) => route.path === "today")).toBe(true);
    expect(childRoutes.some((route) => route.path === "onboarding")).toBe(true);
  });

  it("points both desktop and mobile Today navigation to /today", () => {
    render(
      <MemoryRouter initialEntries={["/today"]}>
        <AuthContext.Provider value={authenticatedAuthContext}>
          <App />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    const todayLinks = screen.getAllByRole("link", { name: "Today" });
    expect(todayLinks).toHaveLength(2);
    expect(todayLinks.every((link) => link.getAttribute("href") === "/today")).toBe(
      true,
    );
  });
});

const authenticatedAuthContext: AuthContextValue = {
  state: {
    status: "authenticated",
    session: {} as NonNullable<AuthContextValue["state"]["session"]>,
  },
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
};
