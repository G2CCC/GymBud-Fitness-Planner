# GymBud Frontend UI Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build the first production-quality GymBud responsive web interface for Today, Calendar, Workout, Progress, and Profile flows using the approved Athletic Calm visual system.

**Architecture:** Add a small, typed read model for the client instead of making each page reconstruct Prisma data. The React client consumes shared API contracts, renders through a small semantic UI layer, and uses Tailwind for layout while keeping design tokens and premium effects in CSS. Page components remain separate from domain validation and server persistence rules so the same product semantics can later be implemented in SwiftUI or React Native.

**Tech Stack:** React 19, TypeScript, Vite 7, React Router 7, Tailwind CSS v4, CSS custom properties, CSS Modules or named effect classes, Vitest, JSDOM, Testing Library, Express, Prisma, and the existing @fitness/shared package.

**Spec:** docs/superpowers/specs/2026-09-14-gymbud-frontend-ui-design.md

## Global Constraints

- Use Athletic Calm only: warm off-white background, white surfaces, restrained green accents, dark ink text, and light amber/red semantic states.
- Use the approved palette through semantic tokens: background #F3F5EF, surface #FFFFFF, border #E1E8DC, ink #17201B, muted #6A746C, muted surface #DCE3DC, accent #93C465, accent strong #77A85A, accent soft #C8E88C, success #4E8B62, warning #B9823C, and danger #B85C55.
- Use Tailwind CSS v4 for layout, spacing, responsive breakpoints, typography utilities, and ordinary component styling.
- Use CSS custom properties for semantic design tokens. Use named CSS effect classes or CSS Modules for gradients, glass surfaces, and motion states.
- Limit gradients to the Today hero, cycle progress, and selected empty states.
- Limit glass effects to the sticky navigation, mobile bottom navigation, dialogs, and detail sheets. Calendar and form surfaces remain solid.
- Prefer opacity and transform for animation. Respect prefers-reduced-motion. Provide an opaque fallback before backdrop-filter is available.
- Preserve the existing cycle lifecycle and workout mutation rules. The client must not silently cascade changes to unrelated workouts.
- Support a 320px viewport. Mobile touch targets are at least 44px. Status must be communicated with text or labels, not color alone.
- Implement loading, empty, error, disabled, and success states deliberately for every data-backed view.
- Do not add dark mode, nutrition, social, messaging, native iOS code, or a server model redesign in this phase.
- The client must not import Prisma or server-only modules.

## Current Repository Constraints

- client/src/App.tsx is currently a placeholder and client/src/router.tsx only exposes the root route.
- The server already owns cycle lifecycle, workout mutation, workout logging, exercise, and cycle-review rules.
- The current client has activity-specific form components but no shared styling system, API repository layer, or browser-test environment.
- The server has mutation routes but no focused dashboard read model and no profile read/update route.
- The first implementation therefore adds the smallest read-model and profile endpoints needed by the UI, then builds the pages on top of those stable contracts.

## File and Responsibility Map

### Styling and test foundation

- Modify client/package.json for Tailwind v4, class-name utilities, and browser testing dependencies.
- Modify client/vite.config.ts to load the Tailwind Vite plugin.
- Modify vitest.config.ts to use JSDOM for client component tests while retaining Node for server tests.
- Create client/src/styles/tokens.css for semantic CSS variables.
- Create client/src/styles/tailwind.css for the Tailwind v4 import and token mapping.
- Create client/src/styles/effects.css for gradient, glass, focus, and motion classes.
- Create client/src/styles/global.css for reset, typography defaults, and application-level accessibility styles.
- Create client/src/test/setup.ts for Testing Library and jest-dom setup.

### Shared API boundary

- Modify shared/src/api/client.ts to support typed GET, POST, PATCH, and PUT requests through one request implementation.
- Modify shared/src/api/contracts.ts only when common response or error contracts need to be extended.
- Create shared/src/api/dashboard-contracts.ts for client-safe dashboard, profile, and cycle-review read/write types.
- Modify shared/src/index.ts to export the new contracts.

### Server read models

- Create server/src/dashboard/mapper.ts for pure Prisma-record-to-API mapping.
- Create server/src/dashboard/service.ts for user-scoped dashboard queries.
- Create server/src/dashboard/routes.ts for GET /api/dashboard.
- Create server/src/profile/service.ts for profile read/update operations using existing profile validation.
- Create server/src/profile/routes.ts for GET and PATCH /api/profile.
- Modify server/src/app.ts or the existing route composition file to mount dashboard and profile routes.
- Create server/tests/unit/dashboard-mapper.test.ts.
- Create server/tests/integration/dashboard.test.ts.
- Create server/tests/integration/profile.test.ts.

### Client application and UI

- Modify client/src/main.tsx to load global styles and providers.
- Modify client/src/App.tsx and client/src/router.tsx to use the application shell and all destinations.
- Create client/src/lib/cn.ts for class-name composition.
- Create client/src/lib/api.ts for the configured shared API client.
- Create client/src/providers/AppProviders.tsx for repository and UI context that must be shared across routes.
- Create client/src/components/ui/AppShell.tsx, Button.tsx, Card.tsx, Badge.tsx, ProgressBar.tsx, GlassSurface.tsx, Dialog.tsx, and ui.test.tsx.
- Create feature folders under client/src/features/dashboard, calendar, workouts, progress, cycle-review, and profile.
- Create page files under client/src/pages: TodayPage.tsx, CalendarPage.tsx, WorkoutPage.tsx, ProgressPage.tsx, and ProfilePage.tsx.
- Add colocated browser tests for each feature’s view model and critical interaction states.

## Implementation Tasks

### Task 1: Establish the styling and browser-test foundation

**Files**

- Modify client/package.json, client/vite.config.ts, and vitest.config.ts.
- Create client/src/test/setup.ts, client/src/styles/tokens.css, client/src/styles/tailwind.css, client/src/styles/effects.css, and client/src/styles/global.css.
- Modify client/src/main.tsx to import the style entry files and test-safe application bootstrap.

**Steps**

- [ ] Add Tailwind CSS v4, the Vite integration, clsx, tailwind-merge, JSDOM, Testing Library, user-event, and jest-dom using versions compatible with the existing React 19 and Vite 7 toolchain.
- [ ] Add Tailwind’s Vite plugin beside the existing React plugin without replacing the current Vite configuration.
- [ ] Configure Vitest so client/src/**/*.test.tsx runs in JSDOM and server tests continue to run in Node.
- [ ] Import jest-dom matchers from client/src/test/setup.ts and keep setup idempotent under Vitest.
- [ ] Define the semantic token variables for color, surface, border, text, spacing, radii, shadow, and motion duration.
- [ ] Map the semantic variables into Tailwind v4 theme variables so utility classes use semantic names instead of raw hex values.
- [ ] Add the hero-gradient, cycle-gradient, selected-empty-gradient, glass-surface, focus-ring, and motion-safe utility classes.
- [ ] Give glass-surface an opaque surface fallback and only enhance it with backdrop-filter inside a feature-support rule.
- [ ] Add a reduced-motion media rule that disables nonessential transitions and animation while preserving state changes.
- [ ] Add global box sizing, body typography, focus-visible behavior, and a 320px-safe overflow policy.
- [ ] Verify client typecheck and production build before any page work.

**Verification**

- Run npm run typecheck --workspace @fitness/client. Expected result: no TypeScript errors.
- Run npm run build --workspace @fitness/client. Expected result: Vite produces a production bundle.
- Run git diff --check. Expected result: no whitespace errors.

**Commit**

- Commit as feat: establish GymBud UI styling foundation.

### Task 2: Add typed dashboard and profile read models

**Files**

- Modify shared/src/api/client.ts and shared/src/api/contracts.ts.
- Create shared/src/api/dashboard-contracts.ts and modify shared/src/index.ts.
- Create server/src/dashboard/mapper.ts, server/src/dashboard/service.ts, and server/src/dashboard/routes.ts.
- Create server/src/profile/service.ts and server/src/profile/routes.ts.
- Modify the server route composition file.
- Create server/tests/unit/dashboard-mapper.test.ts, server/tests/integration/dashboard.test.ts, and server/tests/integration/profile.test.ts.

**Interfaces**

- DashboardWorkout contains id, activityType, scheduledDate, location, durationMinutes, status, source, cancellationReason, completedAt, and rescheduleCount.
- DashboardResponse contains profile, an optional cycle with id, status, startDate, endDate, timezone, and reviewStatus, and a workouts array.
- Profile endpoints use the existing ProfileInput shape and existing profileInputSchema; they do not create a second profile validation model.
- ApiClient exposes get<T>, post<T>, patch<T>, and put<T>, all using one request method that parses ApiResponse<T> and converts non-success responses to ApiError.

**Steps**

- [ ] Define client-safe contracts using existing shared domain enums rather than duplicating string unions.
- [ ] Serialize every server Date as an ISO string at the mapper boundary.
- [ ] Implement mapDashboardRecord as a pure function and test planned, completed, cancelled, extra, and null optional values.
- [ ] Query only the current user’s active cycle; if there is no active cycle, return the latest draft cycle when available, otherwise return null.
- [ ] Return workouts only for the selected cycle and order them by scheduled date, then creation time.
- [ ] Calculate reviewStatus only through the existing cycle service rules and never infer a new lifecycle state in the mapper.
- [ ] Implement profile GET and PATCH with the authenticated demo-user resolver already used by the server.
- [ ] Validate PATCH input through profileInputSchema, return field-level validation errors in the existing API error shape, and preserve unrelated profile fields.
- [ ] Add ownership tests proving another user cannot read or update the dashboard or profile.
- [ ] Add route tests for empty-cycle behavior, date serialization, validation errors, and successful updates.

**Verification**

- Run npm test -- --testTimeout=30000 server/tests/unit/dashboard-mapper.test.ts server/tests/integration/dashboard.test.ts server/tests/integration/profile.test.ts. Expected result: all new server tests pass.
- Run npm run typecheck. Expected result: shared, server, and client compile together.

**Commit**

- Commit as feat: expose typed dashboard and profile read models.

### Task 3: Build semantic UI primitives and the responsive application shell

**Files**

- Modify client/src/main.tsx, client/src/App.tsx, and client/src/router.tsx.
- Create client/src/lib/cn.ts, client/src/lib/api.ts, and client/src/providers/AppProviders.tsx.
- Create client/src/components/ui/AppShell.tsx, Button.tsx, Card.tsx, Badge.tsx, ProgressBar.tsx, GlassSurface.tsx, Dialog.tsx, and ui.test.tsx.

**Interfaces**

- AppShellProps accepts the active route and page content without coupling navigation to a page implementation.
- Button supports primary, secondary, ghost, and danger variants plus loading and disabled states.
- Badge supports planned, completed, cancelled, overdue, review-required, and neutral labels.
- ProgressBar accepts value, max, label, and optional tone, and exposes the correct progressbar ARIA attributes.

**Steps**

- [ ] Implement cn with clsx and tailwind-merge so component variants remain readable and conflict-safe.
- [ ] Create one navigation definition with Today, Calendar, Progress, and Profile routes; use it for both desktop and mobile navigation.
- [ ] Render a desktop left rail at the desktop breakpoint, a compact tablet navigation treatment, and a fixed mobile bottom bar below that breakpoint.
- [ ] Reserve safe-area padding for the mobile bottom bar so future mobile-web and iOS shells do not overlap content.
- [ ] Ensure each navigation item has an accessible name and the active item is communicated by text, icon treatment, and aria-current.
- [ ] Implement Button with a visible disabled/loading state and a minimum 44px interactive area.
- [ ] Implement Card as a solid surface and GlassSurface as the only reusable glass variant.
- [ ] Implement Badge with text labels and semantic status styling that remains understandable without color.
- [ ] Implement ProgressBar with a visible label and aria-valuenow, aria-valuemin, and aria-valuemax.
- [ ] Implement Dialog with focus-visible styling, close button labeling, escape handling, and reduced-motion behavior.
- [ ] Add tests for navigation landmarks, active route semantics, button disabled state, badge text, progressbar semantics, and dialog labeling.

**Verification**

- Run npm test -- --testTimeout=30000 client/src/components/ui/ui.test.tsx. Expected result: all primitive and shell tests pass in JSDOM.
- Run npm run typecheck --workspace @fitness/client. Expected result: no client type errors.

**Commit**

- Commit as feat: add GymBud UI primitives and app shell.

### Task 4: Implement the Today dashboard

**Files**

- Create client/src/features/dashboard/dashboard-repository.ts, useDashboard.ts, dashboard-model.ts, TodayHero.tsx, WeeklyProgress.tsx, CycleProgressCard.tsx, NextWorkoutCard.tsx, and dashboard.test.tsx.
- Create client/src/pages/TodayPage.tsx.
- Modify client/src/router.tsx and client/src/providers/AppProviders.tsx.

**Interfaces**

- DashboardRepository has getDashboard(): Promise<DashboardResponse>.
- DashboardViewState distinguishes loading, error, empty, review-required, and ready states.
- Dashboard model helpers calculate today’s workouts, completed weekly count, total weekly count, and cycle completion progress without changing persisted data.

**Steps**

- [ ] Implement a repository that calls GET /api/dashboard through the shared ApiClient.
- [ ] Implement a hook with loading, error, retry, and successful data states; do not turn a failed request into an empty dashboard.
- [ ] Prioritize cycle review when reviewStatus is required, then show the next planned or overdue workout, then show a meaningful empty state.
- [ ] Build TodayHero with the current system date, a concise greeting, and one primary action.
- [ ] Build WeeklyProgress and CycleProgressCard with explicit counts, dates, and accessible progress labels.
- [ ] Build NextWorkoutCard to distinguish planned, overdue, completed, and cancelled workouts with text actions.
- [ ] Use the approved hero and progress gradients only in the specified locations.
- [ ] Add tests for loading, server error with retry, no cycle, review-required cycle, overdue workout, and completed workout.
- [ ] Keep the data model independent of browser layout so a future mobile client can reuse the same response semantics.

**Verification**

- Run npm test -- --testTimeout=30000 client/src/features/dashboard/dashboard.test.tsx. Expected result: all dashboard state tests pass.
- Run npm run build --workspace @fitness/client. Expected result: the dashboard is included in the production bundle.

**Commit**

- Commit as feat: add Today dashboard.

### Task 5: Implement the four-week calendar and safe workout actions

**Files**

- Create client/src/features/calendar/calendar-model.ts, calendar-actions.ts, CalendarGrid.tsx, CalendarDay.tsx, WorkoutCard.tsx, WorkoutActionMenu.tsx, RescheduleDialog.tsx, CancelDialog.tsx, and calendar.test.tsx.
- Create client/src/pages/CalendarPage.tsx.
- Modify client/src/router.tsx and client/src/providers/AppProviders.tsx.

**Interfaces**

- CalendarDay contains a local calendar date and the workouts displayed on that date.
- groupWorkoutsByLocalDate(workouts, timezone) groups ISO timestamps using the cycle timezone and preserves all workouts on the same date.
- WorkoutActionState distinguishes idle, submitting, success, and error for reschedule, location update, and cancellation.

**Steps**

- [ ] Implement a pure grouping helper and test two workouts that share a local date plus a workout crossing a UTC date boundary.
- [ ] Render exactly the active cycle’s 28-day range when an active or draft cycle exists; keep dates and cycle status visible.
- [ ] Render planned, completed, cancelled, overdue, and extra workouts with badges and explicit labels.
- [ ] Provide a compact month-like desktop grid and a readable mobile agenda without changing the domain data.
- [ ] Call the existing reschedule, location-update, and cancel endpoints only after explicit user confirmation.
- [ ] Preserve the original scheduled date in the workout detail or action history where the server already exposes it.
- [ ] Refresh the dashboard/calendar model after a successful mutation. Do not optimistically mutate unrelated workouts.
- [ ] Disable duplicate submissions and retain the dialog on errors so the user can correct the input.
- [ ] Add tests for grouping, empty days, same-day multiple workouts, overdue labels, confirmation behavior, successful refresh, and failed mutation recovery.

**Verification**

- Run npm test -- --testTimeout=30000 client/src/features/calendar/calendar.test.tsx. Expected result: calendar model and action tests pass.
- Run npm run typecheck --workspace @fitness/client. Expected result: no calendar type errors.

**Commit**

- Commit as feat: add cycle calendar and workout actions.

### Task 6: Implement workout detail and logging

**Files**

- Create client/src/features/workouts/workout-repository.ts, useWorkout.ts, workout-form-model.ts, WorkoutHeader.tsx, WorkoutStatusPanel.tsx, WorkoutLogForm.tsx, WorkoutActionPanel.tsx, and workout.test.tsx.
- Create client/src/pages/WorkoutPage.tsx.
- Modify the existing StrengthLogForm.tsx, CardioLogForm.tsx, SportLogForm.tsx, client/src/router.tsx, and the relevant shared exports.

**Interfaces**

- Workout mutation state contains idle, loading, success, and error plus a retryable message.
- Strength input preserves planned exercise and planned set values separately from actual set values.
- Cardio input supports actual completion date/time, duration, distance, pace or speed, and intensity according to existing server validation.
- Sport input supports actual completion date/time, duration, intensity, and notes according to existing server validation.

**Steps**

- [ ] Load one workout through GET /api/workouts/:id and render a clear not-found or unauthorized error state.
- [ ] Keep planned data read-only while pre-filling editable actual fields where the server permits it.
- [ ] Make actual completion date and time mandatory for backfill flows, and block submit with a field-level message when either value is absent.
- [ ] Route strength, cardio, and sport submissions to the existing log and completion endpoints; do not send RPE fields because MVP does not collect subjective feedback.
- [ ] Keep actual weights, repetitions, and sets separate from recommended or planned values.
- [ ] Preserve entered values across a recoverable server error and provide retry without losing the form.
- [ ] Expose secondary reschedule and cancel actions through the same confirmation patterns as Calendar.
- [ ] Add tests proving the completion timestamp requirement, activity-specific fields, duplicate-submit prevention, server-error recovery, and successful completion.

**Verification**

- Run npm test -- --testTimeout=30000 client/src/features/workouts/workout.test.tsx. Expected result: workout form and mutation tests pass.
- Run npm test -- --testTimeout=30000 server/tests/integration/workout-log.test.ts. Expected result: existing workout persistence behavior remains green.

**Commit**

- Commit as feat: add workout detail and logging UI.

### Task 7: Implement Progress, Cycle Review, and Profile

**Files**

- Create client/src/features/progress/progress-model.ts, ProgressSummary.tsx, and progress.test.tsx.
- Create client/src/features/cycle-review/CycleReviewPanel.tsx and cycle-review.test.tsx.
- Create client/src/features/profile/ProfileForm.tsx and profile.test.tsx.
- Create client/src/pages/ProgressPage.tsx and client/src/pages/ProfilePage.tsx.
- Modify the existing CycleReviewForm.tsx and client/src/router.tsx.

**Interfaces**

- CycleReviewMutation accepts the optional user summary and the existing review decision without making the summary mandatory.
- ProfileFormValues exactly follows ProfileInput and uses the existing schema constraints.
- ProgressSummary is an objective projection of completion, cancellation, reschedule, duration, distance, and strength-log data returned by the server.

**Steps**

- [ ] Build Progress from objective server data and display completion rate, planned versus completed sessions, cancellation count, reschedule count, and activity-specific totals.
- [ ] Represent a cycle with zero completed workouts without dividing by zero or hiding the empty result.
- [ ] Show the cycle review only when the server says review is required.
- [ ] Keep the user summary textarea optional; submit an absent or blank summary as no summary rather than inventing content.
- [ ] Use the existing review and next-draft endpoints, show the returned draft state, and require explicit confirmation before the next cycle is written.
- [ ] Load and update Profile through GET and PATCH /api/profile, including weekly days, concrete training dates, training location classification, and the existing primary/secondary goal rules.
- [ ] Do not add timezone editing because the product currently follows the system clock in the web and future mobile clients.
- [ ] Add tests for optional summary, zero-data progress, review-required gating, profile validation errors, successful update, and retry.

**Verification**

- Run npm test -- --testTimeout=30000 client/src/features/progress/progress.test.tsx client/src/features/cycle-review/cycle-review.test.tsx client/src/features/profile/profile.test.tsx. Expected result: all review, progress, and profile tests pass.
- Run npm test -- --testTimeout=30000 server/tests/integration/cycle-review.test.ts server/tests/integration/profile.test.ts. Expected result: existing lifecycle and profile behavior remains green.

**Commit**

- Commit as feat: add progress review and profile screens.

### Task 8: Complete responsive, accessibility, visual, and release verification

**Files**

- Modify only the concrete files identified by verification, normally client/src/styles/global.css, client/src/styles/effects.css, or the affected UI component.
- Create client/src/app-accessibility.test.tsx.
- Update documentation only if a command, environment variable, or API contract changed.

**Steps**

- [ ] Test the app shell landmark structure, navigation accessible names, current-route semantics, dialog labeling, button names, status text, and progressbar values.
- [ ] Verify keyboard focus visibility and keyboard operation for navigation, dialogs, action menus, and forms.
- [ ] Verify disabled and loading states prevent duplicate mutations.
- [ ] Verify loading, empty, error, and success states exist for Today, Calendar, Workout, Progress, Review, and Profile.
- [ ] Verify 320px, mobile, tablet, and desktop layouts without horizontal scrolling or bottom-nav overlap.
- [ ] Verify gradients appear only in approved locations and glass surfaces remain readable with the opaque fallback.
- [ ] Verify reduced-motion behavior removes nonessential transitions while preserving confirmation and state feedback.
- [ ] Run the complete test suite and production checks.
- [ ] Check that .superpowers/ is not staged, no environment file is staged, and no generated database artifact was added to the client.

**Verification**

- Run npm test -- --testTimeout=30000. Expected result: all server and client tests pass.
- Run npm run typecheck. Expected result: all workspaces compile without errors.
- Run npm run build --workspace @fitness/client. Expected result: production client build succeeds.
- Run git diff --check. Expected result: no whitespace errors.
- Run git status --short. Expected result: only intended source, test, documentation, and migration files are present.

**Commit**

- Commit as feat: complete GymBud responsive web UI.

## Plan Self-Review

- The plan covers the approved palette, controlled gradients, glass fallback, reduced motion, four destinations, calendar and workout states, optional cycle summary, responsive navigation, accessibility, API states, and a future-mobile-friendly separation of data and presentation.
- Existing server lifecycle and workout rules remain authoritative. The frontend adds read models and invokes existing mutation routes rather than reimplementing persistence behavior.
- The missing dashboard/profile read boundary is addressed before UI pages consume data.
- Every implementation task names concrete files, interfaces, tests, verification commands, and a commit boundary.
- The plan contains no placeholder implementation step. Any later adjustment must be tied to a failing verification or an explicit product decision.
