# Calendar and Global Visual Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Calendar the authenticated GymBud home, replace the weekly view with a Monday-to-Sunday monthly calendar whose workouts open a detail drawer, and apply the approved white/navy/emerald/blue/violet visual system across the product and landing page.

**Architecture:** Keep FullCalendar as the calendar engine, but make the client load user-scoped workout summaries by visible date range instead of only the current weekly cycle. Keep workout state transitions and mutations in the existing server/domain services; the Calendar page only selects, displays, and delegates actions. Centralize the new visual language in the existing semantic CSS variables and Tailwind theme so existing pages migrate without duplicating colors.

**Tech Stack:** React 19, React Router, FullCalendar dayGrid, TypeScript, Tailwind CSS v4, Express, Prisma, Zod, Vitest, and Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-23-calendar-global-theme-design.md`

## Global Constraints

- The visual system remains light-only; do not add dark mode.
- Workout statuses remain exactly `PLANNED`, `COMPLETED`, and `CANCELLED`.
- Weekly cycles, review logic, AI generation/validation/confirmation, weight recommendations, and planned-versus-actual logging remain unchanged.
- Calendar browsing must not reschedule, cancel, complete, or otherwise mutate a workout.
- Every calendar query is scoped by the authenticated user ID.
- `client` imports API contracts/helpers only; it never imports Prisma or server modules.
- Calendar dates use the existing stored calendar-date convention and must not be shifted by browser timezone conversion.
- The existing workout page remains the authoritative place for completing and logging a workout.
- Primary navigation contains Calendar, Progress, and Profile; Today is not a navigation item or authenticated route.
- The theme uses semantic variables and the target relationships: warm white background, pure white surfaces, deep navy ink, emerald primary, blue Cardio, violet Sport.

## Review Focus

- A month that starts on Sunday or ends on Monday must still render Monday through Sunday and request the correct inclusive range; cover it in the calendar range/date tests in Task 3 and the month-view tests in Task 4.
- Adjacent-month filler dates must not make the current month appear to contain duplicate workouts; cover visible-range mapping and event-date rendering in Task 4.
- A user must never see another user's workout in a calendar range; cover authenticated user scoping in the CalendarService integration test in Task 3.
- A selected workout may disappear or change status after the calendar list loads; cover a detail fetch error and stale selection cleanup in the drawer tests in Task 5.
- Removing Today must not leave an auth redirect, navigation link, or route reference behind; cover route/auth/navigation assertions in Task 1 and run the repository-wide reference scan in Task 7.

### Task 1: Make Calendar the authenticated home and remove Today navigation

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/router.tsx`
- Modify: `client/src/pages/auth/AuthPage.tsx`
- Modify: `client/tests/ui/auth.test.tsx`
- Modify: `client/tests/ui/today.test.tsx` (replace route/navigation assertions before deleting the Today-only test file)
- Create: `client/tests/ui/navigation.test.tsx`
- Delete after migration: `client/src/pages/today/TodayPage.tsx`
- Delete after migration: `client/src/features/today/today-model.ts`
- Delete after migration: `client/tests/ui/today.test.tsx`

**Interfaces:**
- `LandingRoute` sends authenticated users to `/calendar`.
- `AuthPage` sends successful sign-in and sign-up-with-session flows to `/calendar`.
- `App` renders exactly three primary navigation destinations: Calendar, Progress, and Profile.
- The protected router contains `calendar`, `onboarding`, `workouts/:workoutId`, `review/:cycleId`, `progress`, and `profile`, but no `today` route.

- [ ] **Step 1: Update the route and navigation tests to describe the new contract**

Change the existing auth expectations from Today to Calendar and add a focused navigation test:

```tsx
it("redirects an authenticated root route to Calendar", async () => {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <AuthContext.Provider value={authenticatedAuthContext}>
        <Routes>
          <Route element={<LandingRoute />} path="/" />
          <Route element={<h1>Calendar</h1>} path="/calendar" />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  expect(await screen.findByRole("heading", { name: "Calendar" })).toBeInTheDocument();
});
```

The navigation test should render `App` with an authenticated context and assert that desktop and mobile expose Calendar, Progress, and Profile, while `screen.queryAllByRole("link", { name: "Today" })` is empty.

- [ ] **Step 2: Run the focused tests and verify they fail for the old Today behavior**

Run: `npm test -- client/tests/ui/auth.test.tsx client/tests/ui/navigation.test.tsx`

Expected: FAIL because the current root redirect, auth redirects, and navigation still point to `/today`.

- [ ] **Step 3: Update the shell, router, and auth redirects**

In `App.tsx`, change the navigation array to:

```tsx
const navigation = [
  { label: "Calendar", to: "/calendar" },
  { label: "Progress", to: "/progress" },
  { label: "Profile", to: "/profile" },
] as const;
```

In `router.tsx`, change the authenticated `Navigate` target to `/calendar`, remove the Today import and child route, and keep the existing contextual routes. In `AuthPage.tsx`, change every post-auth `navigate("/today", { replace: true })` or `navigate("/today")` to the matching `/calendar` destination.

- [ ] **Step 4: Migrate auth tests and remove the obsolete Today-only modules**

Update protected-route and sign-out test fixtures to use `/calendar`. Move any still-relevant navigation assertion into `navigation.test.tsx`. Verify no remaining client source imports `TodayPage`, `today-model`, or the `/today` path, then delete the Today page, model, and obsolete Today UI test.

- [ ] **Step 5: Run the focused route and navigation tests**

Run: `npm test -- client/tests/ui/auth.test.tsx client/tests/ui/navigation.test.tsx`

Expected: PASS with no Today links and all authenticated entry points landing on Calendar.

- [ ] **Step 6: Commit the route migration**

```bash
git add client/src/App.tsx client/src/router.tsx client/src/pages/auth/AuthPage.tsx client/src/pages/today client/src/features/today client/tests/ui/auth.test.tsx client/tests/ui/navigation.test.tsx client/tests/ui/today.test.tsx
git commit -m "refactor: make calendar the authenticated home"
```

### Task 2: Replace the global visual tokens and shared effects

**Files:**
- Modify: `client/src/styles/tokens.css`
- Modify: `client/src/styles/tailwind.css`
- Modify: `client/src/styles/global.css`
- Modify: `client/src/styles/effects.css`
- Modify: `client/src/components/calendar/WorkoutCard.tsx`
- Modify: `client/tests/ui/calendar.test.tsx`

**Interfaces:**
- Existing semantic classes such as `bg-gymbud-background`, `text-gymbud-ink`, `bg-gymbud-accent-soft`, and `border-gymbud-border` continue to work.
- New semantic classes expose `activity-strength`, `activity-cardio`, and `activity-sport` colors without hard-coded values in page components.
- `.button-primary`, `.glass-surface`, gradients, and focus rings all read the new token values.

- [ ] **Step 1: Add a failing activity-style assertion to the workout-card test**

Render one Strength, Cardio, and Sport workout and assert each event exposes a stable semantic class or data attribute:

```tsx
expect(screen.getByRole("button", { name: /strength workout/i })).toHaveAttribute(
  "data-activity",
  "strength",
);
```

Repeat for `cardio` and `sport`. This pins the activity-to-color contract without testing a browser's computed CSS.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- client/tests/ui/calendar.test.tsx`

Expected: FAIL because WorkoutCard currently has no activity data attribute or activity-specific semantic class.

- [ ] **Step 3: Replace the token values and add activity tokens**

Set the semantic values in `tokens.css` to the approved direction:

```css
:root {
  color-scheme: light;
  --color-background: #f7f9f8;
  --color-surface: #ffffff;
  --color-surface-muted: #f1f4f5;
  --color-border: #e1e7ea;
  --color-ink: #10213f;
  --color-muted: #5e6b80;
  --color-accent: #119b61;
  --color-accent-strong: #087a4a;
  --color-accent-soft: #ddf5e9;
  --color-activity-strength: #119b61;
  --color-activity-strength-soft: #ddf5e9;
  --color-activity-cardio: #2b7de9;
  --color-activity-cardio-soft: #e1efff;
  --color-activity-sport: #7355d8;
  --color-activity-sport-soft: #eee9ff;
  --color-success: #138a5b;
  --color-warning: #b7791f;
  --color-danger: #c05656;
  --shadow-card: 0 18px 45px rgb(16 33 63 / 0.08);
}
```

Expose the new variables from the Tailwind v4 `@theme` block. Keep radius and motion tokens unless browser QA shows a contrast or density problem.

- [ ] **Step 4: Update shared effects and focus styling**

Use white-to-mint and white-to-slate backgrounds in `hero-gradient`, `cycle-gradient`, and `selected-empty-gradient`. Update `.focus-ring` to use the emerald accent. Keep the translucent surface treatment, but make its border/shadow navy-tinted rather than green-tinted.

- [ ] **Step 5: Apply activity semantic styles to WorkoutCard**

Map activity type to a semantic class and `data-activity` value. Keep status independently visible. The event should use compact padding for month cells, preserve the existing accessible label, and add a completed/cancelled modifier without replacing the activity color.

- [ ] **Step 6: Run the focused theme/card test**

Run: `npm test -- client/tests/ui/calendar.test.tsx`

Expected: PASS, with Strength/Cardio/Sport mapped to distinct semantic activity identifiers and existing overdue behavior preserved.

- [ ] **Step 7: Commit the visual foundation**

```bash
git add client/src/styles client/src/components/calendar/WorkoutCard.tsx client/tests/ui/calendar.test.tsx
git commit -m "style: establish navy emerald calendar theme"
```

### Task 3: Add the authenticated calendar range API

**Files:**
- Create: `shared/src/domain/calendar/validation.ts`
- Create: `shared/src/domain/calendar/types.ts`
- Modify: `shared/src/index.ts`
- Create: `shared/tests/domain/calendar-range.test.ts`
- Create: `server/src/calendar/service.ts`
- Create: `server/src/routes/calendar/route.ts`
- Modify: `server/src/routes/index.ts`
- Create: `server/tests/integration/calendar.test.ts`

**Interfaces:**
- `calendarRangeQuerySchema` accepts `{ from: string; to: string }` in `YYYY-MM-DD` format, with `from <= to`.
- `calendarDateRangeToUtcBounds(input)` returns `{ from: Date; toExclusive: Date }` using the stored UTC calendar-date convention.
- `CalendarService.listWorkouts(userId, bounds)` returns calendar summaries ordered by `scheduledDate` and `createdAt`.
- `GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD` returns `{ data: { workouts: ApiCalendarWorkout[] } }`.

- [ ] **Step 1: Write failing shared date-range tests**

Cover valid dates, malformed dates, reversed dates, boundary conversion, and a month that includes a Sunday start:

```ts
it("turns an inclusive date range into UTC start and exclusive end bounds", () => {
  const bounds = calendarDateRangeToUtcBounds(
    calendarRangeQuerySchema.parse({ from: "2026-09-01", to: "2026-09-30" }),
  );

  expect(bounds.from).toEqual(new Date("2026-09-01T00:00:00.000Z"));
  expect(bounds.toExclusive).toEqual(new Date("2026-10-01T00:00:00.000Z"));
});
```

- [ ] **Step 2: Run the shared calendar test and verify it fails**

Run: `npm test -- shared/tests/domain/calendar-range.test.ts`

Expected: FAIL because the calendar validation module does not exist.

- [ ] **Step 3: Implement shared date-range validation and summary types**

Use a strict date-key schema, validate that the parsed UTC date serializes back to the same key, and derive the exclusive end by adding one UTC day. Export the module from `shared/src/index.ts`.

Define the platform-neutral summary type:

```ts
export type CalendarWorkoutSummary = {
  id: string;
  cycleId: string;
  activityType: ActivityType;
  scheduledDate: Date;
  durationMinutes: number;
  status: WorkoutStatus;
  completedAt: Date | null;
  rescheduleCount: number;
};
```

- [ ] **Step 4: Add the failing CalendarService ownership/boundary integration test**

Create two database users, add workouts at the `from` and `to` boundaries plus one outside the range, and assert that `listWorkouts` returns both boundary records for the requested user, includes completed/cancelled records, excludes the other user's workout, and orders by date. Skip the integration suite when `DATABASE_URL` is absent, matching existing persistence tests.

- [ ] **Step 5: Run the integration test and verify it fails**

Run: `npm test -- server/tests/integration/calendar.test.ts`

Expected: SKIP without a database, or FAIL with missing `CalendarService` when a database is configured.

- [ ] **Step 6: Implement CalendarService and the authenticated route**

Query `scheduledWorkout` with:

```ts
where: {
  userId,
  scheduledDate: { gte: bounds.from, lt: bounds.toExclusive },
}
```

Select only the summary fields needed by the month view. Map Prisma records to the shared summary shape. The route must parse query parameters with the shared schema, get the authenticated user ID, return status `400` for validation errors, and use the existing `INTERNAL_ERROR` response shape for unexpected failures.

Mount the route with `apiRouter.use("/calendar", calendarRouter)` after auth middleware.

- [ ] **Step 7: Run shared and server calendar tests**

Run: `npm test -- shared/tests/domain/calendar-range.test.ts server/tests/integration/calendar.test.ts`

Expected: PASS, with the integration suite skipped only when no database is configured.

- [ ] **Step 8: Commit the calendar API**

```bash
git add shared/src/domain/calendar shared/src/index.ts shared/tests/domain/calendar-range.test.ts server/src/calendar server/src/routes/calendar server/src/routes/index.ts server/tests/integration/calendar.test.ts
git commit -m "feat: add user-scoped calendar range API"
```

### Task 4: Convert Calendar from weekly cycle view to monthly view

**Files:**
- Modify: `client/src/api/contracts.ts`
- Modify: `client/src/api/client.ts`
- Modify: `client/src/components/calendar/CalendarGrid.tsx`
- Modify: `client/src/components/calendar/WorkoutCard.tsx`
- Modify: `client/src/pages/calendar/CalendarPage.tsx`
- Modify: `client/tests/ui/calendar.test.tsx`
- Create: `client/src/features/calendar/calendar-model.ts`
- Create: `client/tests/ui/calendar-model.test.ts`

**Interfaces:**
- `getCalendarWorkouts(from: string, to: string): Promise<ApiCalendarWorkout[]>` loads summaries for an inclusive date range.
- `getCalendarVisibleRange(start: Date, endExclusive: Date): { from: string; to: string }` converts FullCalendar's visible range without local-time shifts.
- `CalendarGrid` accepts `workouts`, `initialDate`, and `onSelectWorkout`, and uses `dayGridMonth` with `firstDay={1}`.
- `CalendarPage` keeps the current cycle only for existing add/reschedule/cancel/review actions; month events come from the range endpoint.

- [ ] **Step 1: Add failing calendar-model tests**

Test date-key formatting and FullCalendar's exclusive end conversion:

```ts
it("requests the visible month range without shifting the date", () => {
  expect(
    getCalendarVisibleRange(
      new Date("2026-08-31T00:00:00.000Z"),
      new Date("2026-10-05T00:00:00.000Z"),
    ),
  ).toEqual({ from: "2026-08-31", to: "2026-10-04" });
});
```

Also cover a five-row month and a six-row month by asserting the expected FullCalendar visible boundaries used by the helper.

- [ ] **Step 2: Run the model test and verify it fails**

Run: `npm test -- client/tests/ui/calendar-model.test.ts`

Expected: FAIL because the calendar model module does not exist.

- [ ] **Step 3: Add the client API contract and helper**

Add `ApiCalendarWorkout` using the summary fields from Task 3 and implement:

```ts
export async function getCalendarWorkouts(
  from: string,
  to: string,
): Promise<ApiCalendarWorkout[]> {
  const result = await request<{ workouts: ApiCalendarWorkout[] }>(
    `/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  return result.workouts;
}
```

Keep `getCurrentCycle` for mutations and review status; do not silently replace it with the new endpoint.

- [ ] **Step 4: Switch CalendarGrid to month view**

Change the FullCalendar configuration to:

```tsx
<FullCalendar
  plugins={[dayGridPlugin]}
  initialView="dayGridMonth"
  initialDate={initialDate}
  firstDay={1}
  fixedWeekCount={false}
  showNonCurrentDates
  headerToolbar={{ left: "prev", center: "title", right: "next today" }}
  datesSet={onVisibleRangeChange}
  events={events}
  eventContent={renderEvent}
  eventClick={handleClick}
  height="auto"
  dayMaxEvents={4}
/>
```

Keep the `Today` control as a calendar jump action. Pass only `workouts` into the grid, not an entire cycle. Use each summary's `scheduledDate.slice(0, 10)` as the event date.

- [ ] **Step 5: Refactor CalendarPage data loading and month URL state**

Read `month` from `useSearchParams`; accept only `YYYY-MM` and fall back to the current local month. On `datesSet`, update the query parameter and request the visible range. Load `getCurrentCycle()` and `getCalendarWorkouts()` independently so a missing active cycle can show a useful empty calendar while add-session/review actions remain accurately gated.

After add, reschedule, or cancel succeeds, reload both the current cycle and the visible calendar range. When the month changes, clear a selected workout that is not in the newly loaded summary list.

- [ ] **Step 6: Run Calendar UI/model tests and verify the monthly contract**

Run: `npm test -- client/tests/ui/calendar.test.tsx client/tests/ui/calendar-model.test.ts`

Expected: PASS for Monday-first date normalization, overdue status, activity markers, visible-range conversion, and existing workout-editor behavior.

- [ ] **Step 7: Commit the monthly calendar conversion**

```bash
git add client/src/api/contracts.ts client/src/api/client.ts client/src/components/calendar client/src/pages/calendar/CalendarPage.tsx client/src/features/calendar client/tests/ui/calendar.test.tsx client/tests/ui/calendar-model.test.ts
git commit -m "feat: show workouts in a monthly calendar"
```

### Task 5: Add the clickable workout details drawer

**Files:**
- Create: `client/src/components/calendar/WorkoutDetailsDrawer.tsx`
- Modify: `client/src/pages/calendar/CalendarPage.tsx`
- Modify: `client/src/components/calendar/WorkoutCard.tsx`
- Modify: `client/tests/ui/calendar.test.tsx`

**Interfaces:**
- `WorkoutDetailsDrawer` accepts `summary`, `workout`, `loading`, `error`, `exerciseNames`, `onClose`, `onReschedule`, and `onCancel` props.
- Selecting a summary fetches the full workout with the existing `getWorkout` helper.
- The drawer uses `/workouts/:workoutId` as the authoritative start/log destination.

- [ ] **Step 1: Write the failing drawer interaction tests**

Mock `getCalendarWorkouts`, `getCurrentCycle`, `getWorkout`, and `listExercises`. Render a CalendarPage fixture with one event, click it, and assert:

```tsx
await user.click(screen.getByRole("button", { name: /strength workout/i }));
expect(await screen.findByRole("heading", { name: /workout details/i })).toBeInTheDocument();
expect(screen.getByText(/60 min/i)).toBeInTheDocument();
expect(screen.getByRole("link", { name: /start workout/i })).toHaveAttribute(
  "href",
  "/workouts/workout-1",
);
```

Also test close-button behavior, completed/cancelled status copy, a failed detail request, and that the selected drawer is cleared after navigating to a month that does not contain the selected event.

- [ ] **Step 2: Run the focused drawer tests and verify they fail**

Run: `npm test -- client/tests/ui/calendar.test.tsx`

Expected: FAIL because the Calendar page currently renders an inline action section and has no details drawer.

- [ ] **Step 3: Implement the drawer with semantic responsive behavior**

Render a fixed right-side panel on large screens and a bottom/full-screen panel below the large breakpoint. Include a labelled close button, date, status, activity, duration, planned exercise/set summary, and the existing workout-page link. Use `role="dialog"`, `aria-modal="true"`, and a heading. Add a document-level Escape listener while open and restore focus to the selected event button when closed.

Use activity-specific accent classes for the activity badge and status-specific semantic classes for Planned, Completed, Cancelled, and Overdue. Do not call mutation APIs from the drawer except through callbacks supplied by CalendarPage.

- [ ] **Step 4: Connect selection and detail loading in CalendarPage**

Keep `selectedSummary` in state. When it changes, call `getWorkout`; if the workout is Strength, call the existing `listExercises` and build a `{ [exerciseId]: name }` map for readable planned exercise names. Cancel stale requests with an `active` flag in the effect. Pass the existing reschedule/cancel handlers into the drawer so business rules remain in the page/API layer.

- [ ] **Step 5: Run the drawer and Calendar tests**

Run: `npm test -- client/tests/ui/calendar.test.tsx`

Expected: PASS with event selection, detail loading, close behavior, status display, and workout-page navigation covered.

- [ ] **Step 6: Commit the details interaction**

```bash
git add client/src/components/calendar/WorkoutDetailsDrawer.tsx client/src/pages/calendar/CalendarPage.tsx client/src/components/calendar/WorkoutCard.tsx client/tests/ui/calendar.test.tsx
git commit -m "feat: open workout details from calendar events"
```

### Task 6: Align the landing page and remaining screens with the new theme

**Files:**
- Modify: `client/src/pages/landing/LandingPage.tsx`
- Modify: `client/tests/ui/landing.test.tsx`
- Review and modify only where a shared token is not enough: `client/src/pages/auth/AuthPage.tsx`, `client/src/pages/onboarding/OnboardingPage.tsx`, `client/src/pages/workouts/WorkoutPage.tsx`, `client/src/pages/progress/ProgressPage.tsx`, `client/src/pages/review/ReviewPage.tsx`, `client/src/pages/profile/ProfilePage.tsx`, and relevant form components.

**Interfaces:**
- Existing marketing copy and public routes remain unchanged unless a Today label would contradict the removal of the Today page.
- The landing hero preview presents Calendar as the product's primary visual metaphor.
- All changed screens use semantic GymBud classes rather than new local hex values.

- [ ] **Step 1: Add the landing-page expectation for the Calendar preview**

Update `landing.test.tsx` to assert the preview contains a Calendar label/month heading and activity labels for Strength, Cardio, and Sport, while preserving the existing public CTA and no-protected-data assertions.

- [ ] **Step 2: Run the landing test and verify it fails**

Run: `npm test -- client/tests/ui/landing.test.tsx`

Expected: FAIL because the current hero preview is labelled Today and does not contain the monthly calendar visual.

- [ ] **Step 3: Replace the landing preview content without adding a new data dependency**

Keep the existing hero layout and copy, but replace the right-hand Today card with a static, accessible mini-calendar preview. Use the same semantic activity classes as the real calendar, display a month label such as `September 2026`, and show compact emerald, blue, and violet event chips. Do not call the protected calendar API from LandingPage.

- [ ] **Step 4: Audit all client source for old lime literals and Today copy**

Run:

```bash
rg -n "#[0-9a-fA-F]{3,8}|rgb\\(|hsl\\(" client/src
rg -n "\\bToday\\b|/today" client/src client/tests
```

The first command should return only intentional token/effect definitions. The second should return only the calendar's utility Today control and explanatory copy that does not describe a page; remove any navigation, redirect, or page references.

- [ ] **Step 5: Run all client UI tests**

Run: `npm test -- client/tests/ui`

Expected: PASS for landing, auth, onboarding, calendar, workout, progress, review, and profile UI behavior.

- [ ] **Step 6: Commit the landing and visual migration**

```bash
git add client/src/pages/landing/LandingPage.tsx client/tests/ui/landing.test.tsx client/src/pages client/src/components
git commit -m "style: align landing and app screens with calendar theme"
```

### Task 7: Full verification and cleanup

**Files:**
- Modify only files identified by failing verification or stale-reference scans.
- Review: `docs/superpowers/specs/2026-09-23-calendar-global-theme-design.md`
- Review: `docs/superpowers/plans/2026-09-23-calendar-global-theme.md`

**Interfaces:**
- All existing domain and server behavior remains green.
- The repository contains no unreachable Today route/page/model or stale tests.

- [ ] **Step 1: Run the repository-wide stale reference scan**

Run:

```bash
rg -n "TodayPage|today-model|path: [\"']today[\"']|navigate\([\"']/today|to=[\"']/today|/today" client server shared --glob '*.{ts,tsx,css}'
```

Expected: no route/import/redirect references. A Calendar utility button may use the visible label `Today`, but it must not use the `/today` path.

- [ ] **Step 2: Run all tests**

Run: `npm test`

Expected: all enabled tests pass; database integration tests may remain skipped when the local database environment is unavailable.

- [ ] **Step 3: Run typechecks and production builds**

Run:

```bash
npm run typecheck
npm run build --workspace @fitness/client
npm run build --workspace @fitness/server
```

Expected: all commands exit successfully with no TypeScript errors.

- [ ] **Step 4: Review the final diff for business-scope changes**

Run: `git diff origin/main...HEAD -- client server shared prisma`

Confirm that changes are limited to navigation, calendar range reads, details presentation, tests, and visual styling. Reject any accidental changes to cycle state machines, AI prompts/schemas, workout completion/backfill validation, or Prisma lifecycle fields.

- [ ] **Step 5: Commit verification fixes if required**

```bash
git add client server shared docs
git commit -m "test: verify calendar redesign and global theme"
```

