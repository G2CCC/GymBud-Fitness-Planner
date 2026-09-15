# Today Dashboard Implementation Plan

> For agentic workers: use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make /today the practical home screen, with setup, review, workout, progress, loading, error, and empty states driven by the existing current-cycle response.

**Architecture:** Add a pure Today view-model module for browser-date comparisons, review precedence, and workout selection. Add a read-only React page that loads getCurrentCycle(), renders the model, and links to existing onboarding, review, workout, and calendar routes. Keep lifecycle, review eligibility, and progress calculations on existing boundaries.

**Tech Stack:** React 19, React Router 7, TypeScript, Vitest, Testing Library, Tailwind CSS 4, existing ApiCycle and ProgressSummary contracts.

**Spec:** docs/superpowers/specs/2026-09-16-today-dashboard-design.md

## Global Constraints

- The browser system clock is authoritative for the web experience.
- Persisted calendar dates are compared by the API ISO date prefix; never convert UTC midnight through the browser timezone.
- Review is due when reviewStatus.reviewRequired, reviewAvailable, or batchReviewStatus.eligible is true.
- Today must not display ORIGINAL, MANUAL, EXTRA, or any source classification.
- Today is read-only; workout and cycle mutations stay on existing routes.
- / redirects to /today and /onboarding remains available.
- The fixed mobile navigation must not cover Today content.
- No database migration, server endpoint, AI call, authentication change, or timezone setting is part of this task.

---

### Task 1: Add the pure Today view model

**Files:**

- Create: client/src/features/today/today-model.ts
- Create/modify: client/tests/ui/today.test.tsx

**Interfaces:**

- Consumes ApiCycle and ApiWorkout from client/src/api/contracts.ts.
- Reuses buildProgressSummary() from client/src/features/progress/progress-model.ts.
- Produces systemDateKey(now?: Date), dateKeyFromIso(value: string), formatDateKey(value: string), buildTodayViewModel(cycle: ApiCycle | null, now?: Date), and the TodayViewModel discriminated union.

- [x] Write failing model tests for null and draft states.

~~~tsx
expect(buildTodayViewModel(null, now)).toEqual({ kind: "NO_CYCLE" });
expect(buildTodayViewModel(cycle({ status: "DRAFT" }), now)).toMatchObject({
  kind: "DRAFT",
});
~~~

- [x] Run the new tests and confirm they fail because today-model.ts does not exist.

Run: npx vitest run client/tests/ui/today.test.tsx -t "model"

- [x] Write failing tests for review precedence.

Use an active cycle with a planned workout dated today. Assert that each server flag independently returns REVIEW_REQUIRED, and that a valid batch exposes its cycle-number label. Review-required output must retain todayWorkouts and a ProgressSummary.

~~~tsx
const result = buildTodayViewModel(
  cycle({
    reviewStatus: { reviewRequired: true, reason: "PAST_END_DATE", today: now },
    workouts: [plannedWorkout("today")],
  }),
  now,
);
expect(result.kind).toBe("REVIEW_REQUIRED");
~~~

- [x] Write failing tests for system-date and selection rules.

Cover all of the following:

1. dateKeyFromIso("2026-09-15T00:00:00.000Z") stays "2026-09-15";
2. systemDateKey() is built from the browser system timezone;
3. every workout on today's date remains in todayWorkouts;
4. the earliest future planned workout is selected on a rest day;
5. the earliest overdue planned workout is selected when no future planned workout exists;
6. focusWorkout is null when no planned workout exists;
7. a closed cycle without review flags returns CLOSED.

Use real ApiWorkout fixtures with persisted calendar date keys and pass an explicit now value to make the tests deterministic.

- [x] Run the date and selection tests and confirm the failures are caused by missing view-model behavior.

Run: npx vitest run client/tests/ui/today.test.tsx -t "date|selection|closed"

- [x] Implement the minimal pure view-model module.

The exported union is:

~~~ts
export type TodayViewModel =
  | { kind: "NO_CYCLE" }
  | { kind: "DRAFT"; cycle: ApiCycle }
  | {
      kind: "REVIEW_REQUIRED";
      cycle: ApiCycle;
      reviewLabel: string;
      todayWorkouts: ApiWorkout[];
      summary: ProgressSummary;
    }
  | {
      kind: "READY";
      cycle: ApiCycle;
      todayWorkouts: ApiWorkout[];
      focusWorkout: ApiWorkout | null;
      summary: ProgressSummary;
    }
  | { kind: "CLOSED"; cycle: ApiCycle; summary: ProgressSummary };
~~~

Use Intl.DateTimeFormat(undefined, { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now) for systemDateKey(). Use value.slice(0, 10) for persisted API date keys. Sort planned candidates by date key and preserve API order for ties. Prefer future planned candidates; if none exist, choose the earliest overdue planned candidate. Check DRAFT before review and check review flags before returning CLOSED.

- [x] Run all model tests and refactor only while green.

Run: npx vitest run client/tests/ui/today.test.tsx -t "model|date|selection|closed"

- [x] Commit the view-model increment.

~~~bash
git add client/src/features/today/today-model.ts client/tests/ui/today.test.tsx
git commit -m "feat: add today dashboard view model"
~~~

### Task 2: Build the Today page states and workout presentation

**Files:**

- Create: client/src/pages/today/TodayPage.tsx
- Modify: client/tests/ui/today.test.tsx

**Interfaces:**

- Consumes getCurrentCycle(), TodayViewModel, buildTodayViewModel(), and ProgressSummary.
- Produces a read-only page at /today with links to /onboarding, /calendar, /review/:cycleId, and /workouts/:workoutId.

- [x] Write failing page tests for loading, error, retry, no-cycle, and draft states.

Mock only getCurrentCycle(). Keep its promise unresolved to prove loading does not show an empty state. Then reject once and resolve on retry.

~~~tsx
expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
expect(screen.queryByText(/open setup/i)).not.toBeInTheDocument();

vi.mocked(api.getCurrentCycle)
  .mockRejectedValueOnce(new Error("Network unavailable"))
  .mockResolvedValueOnce(null);
~~~

Assert NO_CYCLE renders Open setup, DRAFT renders Continue setup, and neither state renders progress or workout data.

- [x] Run the page tests and confirm they fail because TodayPage does not exist.

Run: npx vitest run client/tests/ui/today.test.tsx -t "loading|error|setup|draft"

- [x] Write failing page tests for review, ready, closed, and workout states.

Cover:

- review-required state has a primary /review/cycle-1 link and still shows today's workout context;
- multiple workouts on today are rendered;
- planned, completed, and cancelled statuses are visible text;
- future and overdue focus actions link to the selected workout;
- a closed cycle without pending review shows historical context and Start next cycle;
- no ORIGINAL, MANUAL, or EXTRA strings appear in rendered output;
- the page main element contains pb-28 and lg:pb-8 so mobile navigation cannot cover the final content.

~~~tsx
expect(await screen.findByRole("heading", { name: "Today" })).toBeInTheDocument();
expect(screen.getAllByText(/planned/i).length).toBeGreaterThan(0);
expect(screen.getAllByText(/completed/i).length).toBeGreaterThan(0);
expect(screen.getAllByText(/cancelled/i).length).toBeGreaterThan(0);
expect(screen.queryByText(/original|manual|extra/i)).not.toBeInTheDocument();
~~~

- [x] Run the state tests and confirm the failures are caused by missing page rendering.

Run: npx vitest run client/tests/ui/today.test.tsx -t "review|workout|closed|source"

- [x] Implement the page request lifecycle and explicit state branches.

Use a mounted ref or cleanup guard. Each load must set loading, clear the previous error, call getCurrentCycle(), update cycle state only while mounted, expose the actual error, and clear loading in finally. Render NO_CYCLE, DRAFT, REVIEW_REQUIRED, READY, and CLOSED explicitly. Review is the primary action for REVIEW_REQUIRED; today's workouts and summary may remain visible as context.

- [x] Implement responsive summary and workout cards.

Use an outer main class containing mx-auto, max-w-5xl, px-4, pb-28, sm:px-8, and lg:pb-8. Show the local date, cycle dates, completed sessions, completion rate, cancelled sessions, reschedule count, Strength/Cardio/Sport objective totals, and a View full calendar link. Render all todayWorkouts. Planned workouts link to /workouts/<id> with Start workout, or Open overdue workout when the date key is before today. Completed and cancelled workouts show their status and a View workout link. On a rest day render the selected future or overdue workout in a Next workout section. With no planned workout render a No planned workouts empty state.

- [x] Run all Today page tests and refactor while green.

Run: npx vitest run client/tests/ui/today.test.tsx

- [x] Commit the page increment.

~~~bash
git add client/src/pages/today/TodayPage.tsx client/tests/ui/today.test.tsx
git commit -m "feat: add today dashboard page"
~~~

### Task 3: Make Today the default route and navigation destination

**Files:**

- Modify: client/src/router.tsx
- Modify: client/src/App.tsx
- Modify: client/tests/ui/today.test.tsx

**Interfaces:**

- Consumes TodayPage from client/src/pages/today/TodayPage.tsx.
- Produces an index redirect from / to /today, an explicit /today route, retained /onboarding, and matching desktop/mobile Today navigation links.

- [x] Write failing route and navigation tests.

Assert that the route configuration contains today and onboarding, and that the index element redirects to Today. Render App with a MemoryRouter and assert desktop and mobile navigation both use href="/today".

~~~tsx
expect(router.routes[0]?.children?.some((route) => route.path === "today")).toBe(true);
expect(router.routes[0]?.children?.some((route) => route.path === "onboarding")).toBe(true);
~~~

- [x] Run the route tests and confirm they fail against the current configuration.

Run: npx vitest run client/tests/ui/today.test.tsx -t "route|navigation"

- [x] Implement the route and navigation changes.

Import Navigate and TodayPage. Configure the index route with Navigate to="/today" replace, add path "today", and keep path "onboarding". Change the single Today navigation definition in App.tsx to to="/today"; desktop and mobile will continue to map over the same array.

- [x] Run route, navigation, and client checks.

Run:

~~~bash
npx vitest run client/tests/ui/today.test.tsx
npm run typecheck --workspace client
npm run build --workspace client
~~~

- [x] Commit the route increment.

~~~bash
git add client/src/router.tsx client/src/App.tsx client/tests/ui/today.test.tsx
git commit -m "feat: route users to today dashboard"
~~~

### Task 4: Full verification and handoff

**Files:**

- Modify: docs/superpowers/specs/2026-09-16-today-dashboard-design.md only if the confirmed design status needs updating.
- Modify: docs/superpowers/plans/2026-09-15-today-dashboard.md to track execution.

- [x] Run the complete repository test suite.

Run: npm test

Expected: existing and new tests pass; database integration tests may remain skipped when the configured test database is unavailable.

- [x] Run final static, E2E type, build, and whitespace checks.

Run:

~~~bash
npm run typecheck
npm run typecheck:e2e
npm run build --workspace client
git diff --check
~~~

- [x] Review the diff against the acceptance checklist.

Confirm from the actual diff and tests:

1. / opens Today;
2. /today renders the current-cycle dashboard;
3. /onboarding remains the setup route;
4. review-required is the highest-priority Today action;
5. draft and no-cycle states lead to setup;
6. today, future, and overdue workout states are correct;
7. completed and cancelled status is visible in text;
8. persisted dates do not shift;
9. mobile navigation does not cover Today content;
10. no source classification is rendered.

- [x] Commit final documentation/status updates only after all checks pass.

~~~bash
git add docs/superpowers/specs/2026-09-16-today-dashboard-design.md docs/superpowers/plans/2026-09-15-today-dashboard.md
git commit -m "docs: finalize today dashboard implementation"
~~~

- [x] Report the worktree path, branch, commits, exact test/typecheck/build results, skipped tests, and whether the branch is ready for review or merge. Do not claim changes are on main unless an explicit merge/push is performed and verified.
