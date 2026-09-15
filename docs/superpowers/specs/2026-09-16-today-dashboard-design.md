# Task 10: Today Dashboard and Web UI Loop

**Status:** Approved for implementation
**Date:** 2026-09-16  
**Decision:** Add a read-only Today dashboard on top of the existing current-cycle API; keep lifecycle and workout mutations on their existing server boundaries.

## 1. Goal

When a user opens GymBud, the default route must show the most important next
action for the current training cycle:

1. continue setup when no usable active plan exists;
2. complete a due cycle review before starting another workflow;
3. start or view today's workout;
4. find the next planned workout when today is a rest day;
5. understand the current cycle's progress at a glance.

The Today page is a client-side read model. It does not create a second source
of truth for cycle state, dates, review eligibility, or workout status.

## 2. Scope and non-goals

### In scope

- Add the client route `/today`.
- Redirect the root route to Today through the router's index element.
- Point desktop and mobile `Today` navigation to `/today`.
- Add loading, error, retry, no-cycle, draft-cycle, review-required, ready,
  and no-relevant-workout states.
- Show today's workout(s), the nearest planned/overdue workout when today is a
  rest day, current cycle dates, completion counts, completion rate, and
  activity totals already available from the current-cycle response.
- Link workout actions to the existing workout detail route and review actions
  to the existing cycle review route.
- Keep the page usable at 320px and prevent the fixed mobile navigation from
  covering the page's final content.

### Out of scope

- New database tables, Prisma migrations, or server endpoints.
- Supabase Auth or removal of `DEMO_USER_ID`.
- New AI calls or changes to review/batch-review rules.
- Mutating a workout directly from Today.
- A second dashboard-specific API contract.
- User-editable timezone settings.

## 3. Existing boundaries to preserve

The existing `getCurrentCycle()` client function calls
`GET /api/cycles/current`. The server already selects, in order:

1. the latest active cycle;
2. the latest draft cycle;
3. the latest closed cycle;
4. no cycle.

The response includes `ApiCycle`, its workouts, active-cycle
`reviewStatus`, closed-cycle `reviewAvailable`, and closed-cycle
`batchReviewStatus`. Today must consume these fields as returned and must not
recompute lifecycle eligibility from dates.

`buildProgressSummary()` remains the shared client projection for objective
workout totals. Today may reuse it, but it must not duplicate or alter its
calculation rules.

## 4. Today view model

Create `client/src/features/today/today-model.ts` with pure helpers. The
model owns selection and presentation decisions; it does not call the API or
perform navigation.

The model should expose this explicit discriminated state:

```ts
type TodayViewModel =
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
  | {
      kind: "CLOSED";
      cycle: ApiCycle;
      summary: ProgressSummary;
    };
```

The page must preserve these observable states even if the implementation
splits the type into smaller internal helpers.

### Review precedence

Review is due when at least one server-provided review flag requires user
attention:

```ts
cycle.reviewStatus?.reviewRequired === true ||
cycle.reviewAvailable === true ||
cycle.batchReviewStatus?.eligible === true
```

Review-required state has the highest action priority. It may still show
today's workouts and current-cycle counts as context, but its primary action
must link to `/review/:cycleId`. If a batch is eligible and includes valid
cycle numbers, the page should name that batch in the label; otherwise it uses
`Review cycle`.

### Workout selection precedence

When review is not due:

1. `todayWorkouts` contains every workout whose persisted date key equals the
   browser's local system date key.
2. If there is a planned workout today, the first one is the primary focus;
   all today's workouts remain visible.
3. If today has no workout, select the earliest planned workout on a future
   date.
4. If there is no future planned workout, select the earliest overdue planned
   workout so unresolved work is not hidden.
5. If no planned workout exists, show the no-relevant-workout empty state.

Completed and cancelled workouts are displayed with their text status and a
`View workout` link. Planned workouts use `Start workout`; overdue planned
workouts use `Open overdue workout`. Today never silently changes a status.

## 5. Date handling

The browser's system clock is authoritative for the web experience.

Implement a local `systemDateKey(now = new Date())` using
`Intl.DateTimeFormat(...).formatToParts()` so the result is `YYYY-MM-DD` in the
user's system timezone.

For persisted calendar dates, compare date keys without converting a UTC
midnight value through the browser timezone. A date-key helper must operate on
the API ISO date prefix, and date-key display should construct a local
`YYYY-MM-DDT00:00:00` value only for formatting. This prevents a browser
timezone conversion from moving a cycle or workout to the adjacent day.

No timezone selector or client-side lifecycle calculation is introduced.

## 6. Page structure and interaction

Create `client/src/pages/today/TodayPage.tsx`.

### Loading

Render a semantic `main` region with an `aria-busy="true"` loading message.
The page must not briefly show an empty dashboard while the request is
pending.

### Error

Render the request error in an alert region and provide a labelled `Try again`
button that calls the same loader. A failed request must remain an error, not
be converted into `cycle = null`.

### No cycle

Show an empty-state explanation and a primary `Open setup` link to
`/onboarding`.

### Draft cycle

Show that setup is unfinished and provide a primary `Continue setup` link to
`/onboarding`. Do not display draft data as if it were an active training
cycle.

### Review required

Show a prominent review-needed panel, the current cycle number/date range when
available, and a primary link to `/review/:cycleId`. The panel must preserve
the review status in text; color alone cannot communicate urgency.

### Ready cycle

Show:

- a Today header with the local date;
- the current cycle number and date range;
- completed sessions versus total sessions;
- completion rate;
- Strength, Cardio, and Sport objective totals using the existing progress
  summary;
- today's workout cards, including multiple workouts on the same date;
- the nearest planned or overdue workout when today is a rest day;
- a link to `/calendar` for full four-week planning.

The dashboard must not display `ORIGINAL`, `MANUAL`, `EXTRA`, or any other
training-source classification.

### Closed cycle without a pending review

Show the latest cycle as historical/read-only context and provide a clear
`Start next cycle` link to `/onboarding`. This prevents a user from reaching a
closed-cycle dead end while keeping cycle creation in the existing onboarding
flow.

## 7. Component and file boundaries

### Create

- `client/src/features/today/today-model.ts` — pure date, review-priority,
  workout-selection, and view-model helpers.
- `client/src/pages/today/TodayPage.tsx` — API loading, retry state,
  navigation, and Today layout.
- `client/tests/ui/today.test.tsx` — model and page behavior tests.

### Modify

- `client/src/App.tsx` — change the Today navigation target to `/today` and
  preserve one navigation definition for desktop/mobile.
- `client/src/router.tsx` — add `/today` and make `/` render or redirect to
  Today while retaining `/onboarding`.

Do not move existing Progress, Calendar, Review, or Workout code in this
phase. If a tiny shared helper is required, extract only after a failing test
demonstrates duplication and keep the extraction behavior-preserving.

## 8. Accessibility and responsive behavior

- Use one page-level `main` landmark and a meaningful `h1`.
- Use visible text for every status: planned, completed, cancelled, overdue,
  review required, loading, and error.
- Give primary actions descriptive link/button names, not only icons.
- Use `role="alert"` for load errors and `role="status"` for non-error action
  feedback where applicable.
- Expose completion rate with visible text and, if a progress element is
  used, valid `aria-valuemin`, `aria-valuemax`, and `aria-valuenow` values.
- Preserve visible keyboard focus using the existing `focus-ring` class.
- Keep interactive targets at least 44px high through existing global styles.
- Add bottom padding on Today below the desktop breakpoint so the fixed mobile
  navigation cannot cover the last card or link.
- Use responsive grid utilities that can render at 320px without horizontal
  scrolling.
- Do not add nonessential motion; existing reduced-motion rules remain
  authoritative.

## 9. Error and stale-request handling

`TodayPage` should use the same request lifecycle pattern as ProgressPage:

1. set loading and clear the previous error;
2. await `getCurrentCycle()`;
3. update cycle data only if the component is still mounted;
4. expose the actual error and retry action;
5. clear loading in `finally`.

The page has no mutations, so it does not need optimistic state or mutation
rollback. Links must remain available even when the user has no workout today.

## 10. Test design and acceptance criteria

Tests must be written before production implementation and each new behavior
must first fail for the intended missing-feature reason.

`client/tests/ui/today.test.tsx` must cover at least:

1. the model returns `NO_CYCLE` for a null cycle;
2. a draft cycle returns the setup state;
3. review-required state wins over today's workout state;
4. the model uses the browser system date without UTC date shifting;
5. multiple workouts on today remain visible;
6. completed and cancelled workouts expose view/status text;
7. a future planned workout is selected on a rest day;
8. an overdue planned workout is selected when no future planned workout
   exists;
9. no planned workout produces the empty state;
10. loading renders without empty-state content;
11. API errors render an alert and retry calls the loader again;
12. the root/navigation contract exposes `/today` and retains `/onboarding`;
13. the mobile page includes enough bottom spacing for the fixed navigation;
14. no source-classification labels appear in the rendered page.

Acceptance is reached only when:

```text
/ opens Today
/today renders the current-cycle dashboard
/onboarding remains the setup route
review-required state is the highest-priority Today action
draft/no-cycle states lead to setup
today and next/overdue workout states are correct
completed/cancelled status is visible in text
system-date comparisons do not shift persisted dates
the fixed mobile navigation does not cover Today content
all existing tests still pass
client typecheck passes
client production build passes
git diff --check passes
```
