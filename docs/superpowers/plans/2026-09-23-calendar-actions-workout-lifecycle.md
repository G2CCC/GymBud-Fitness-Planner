# Calendar Actions and Workout Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace cancellation-based workout handling with explicit deletion of unfinished plans, add persistent Calendar actions, and support confirmed single-day Strength AI plans inside an active weekly cycle.

**Architecture:** Keep `ScheduledWorkout` as the single persisted workout model, reduce its status enum to `PLANNED | COMPLETED`, and add a user-scoped delete endpoint for planned workouts. Extend the existing Calendar API contract with server-calculated Review availability, add separate active-cycle single-day plan generation/confirmation methods beside the existing draft-cycle weekly flow, and keep AI output as a client-reviewed draft until confirmation.

**Tech Stack:** TypeScript, React, React Router, Tailwind utility classes, Express, Prisma/PostgreSQL, Zod, Vitest, shared domain types.

**Spec:** `docs/superpowers/specs/2026-09-23-calendar-actions-and-workout-deletion-design.md`

## Global Constraints

- Persisted workout statuses are exactly `PLANNED` and `COMPLETED`.
- Existing `CANCELLED` rows are physically deleted by the migration before the enum value is removed.
- Only `PLANNED` workouts may be deleted; `COMPLETED` workouts are immutable history.
- Review analysis uses completed workouts only and requires all remaining planned workouts to be manually completed or deleted.
- Single-day AI generation is Strength-only, limited to today through the active cycle end date, and never writes the calendar before explicit confirmation.
- A target date with any existing workout blocks single-day generation; a user must delete a planned workout first.
- Calendar action panels are compact, left-aligned, and not full-width.
- The user’s cycle timezone is authoritative for Review availability dates and day counts.

## Review Focus

- A migration against a database containing old `CANCELLED` rows must delete dependent workout data before changing the enum.
- A completed workout deletion request must return a conflict and leave its log/history unchanged.
- A cycle with an unresolved planned workout must keep Review disabled even after the end date until the workout is deleted or completed.
- Single-day generation must reject a date outside the active cycle, a past date, a non-empty date, and non-Strength input.
- AI generation failure or draft abandonment must not create or delete calendar records.

### Task 1: Remove the cancellation state from shared domain behavior

**Files:**
- Modify: `shared/src/domain/enums.ts`
- Modify: `shared/src/domain/workouts/state-machine.ts`
- Modify: `shared/src/domain/cycles/close-cycle.ts`
- Modify: `shared/src/domain/reviews/cycle-volume.ts`
- Modify: `shared/src/domain/reviews/objective-summary.ts`
- Modify: `shared/src/domain/types.ts`
- Test: `shared/tests/domain/workout-state.test.ts`
- Test: `shared/tests/domain/close-cycle.test.ts`
- Test: `shared/tests/domain/cycle-volume.test.ts`
- Test: `shared/tests/domain/objective-summary.test.ts`

**Interfaces:**
- `WorkoutStatus` becomes the two-value union derived from `['PLANNED', 'COMPLETED'] as const`.
- `closeCycle()` returns a close result without cancellation IDs, status updates, restoreable IDs, or cancellation counts.
- Review summary types expose completed/planned facts only as needed; no cancellation totals or cancellation object are returned.

- [ ] **Step 1: Write failing shared-domain tests**

  Replace cancellation assertions with the desired behavior: planned workouts are unresolved until deleted outside the close domain, completed workouts remain valid, and review summaries contain no cancellation fields. Add an assertion that a close operation reports unresolved planned workout IDs without converting them to another status.

- [ ] **Step 2: Run the focused shared tests and verify the expected failures**

  Run: `npm test -- shared/tests/domain/workout-state.test.ts shared/tests/domain/close-cycle.test.ts shared/tests/domain/cycle-volume.test.ts shared/tests/domain/objective-summary.test.ts`

  Expected: failures reference removed cancellation types, restore behavior, or cancellation fields.

- [ ] **Step 3: Implement the two-status domain model**

  Remove cancellation and restore transitions. Change close-cycle output to preserve the list/count of unresolved planned workouts only; do not mutate them. Make objective summaries and review volume derive useful metrics from completed workouts without cancellation fields.

- [ ] **Step 4: Run the focused shared tests and verify they pass**

  Run the same command. Expected: PASS for the updated shared-domain tests.

- [ ] **Step 5: Commit the shared-domain change**

  ```bash
  git add shared/src shared/tests
  git commit -m "refactor: remove cancelled workout state"
  ```

### Task 2: Remove the database cancellation enum and migrate existing data

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260923150000_remove_cancelled_workout_status/migration.sql`
- Test: `server/tests/integration/cycles.test.ts`
- Test: `server/tests/integration/calendar.test.ts`
- Test: `server/tests/integration/workout-log.test.ts`

**Interfaces:**
- Prisma `WorkoutStatus` contains only `PLANNED` and `COMPLETED`.
- The migration permanently deletes existing `ScheduledWorkout` rows with status `CANCELLED`, relying on existing cascading child relations before replacing the enum type.

- [ ] **Step 1: Add migration-focused coverage**

  Update integration fixtures so no new cancelled rows are created. Add a migration SQL review fixture or documented SQL assertion that the old enum is replaced only after old cancelled rows are deleted.

- [ ] **Step 2: Run the affected integration tests and verify the expected failures**

  Run: `npm test -- server/tests/integration/cycles.test.ts server/tests/integration/calendar.test.ts server/tests/integration/workout-log.test.ts`

  Expected: failures identify old cancelled fixtures and service contracts.

- [ ] **Step 3: Update Prisma and write the safe PostgreSQL migration**

  Remove `CANCELLED` from `prisma/schema.prisma`. In the migration, delete old cancelled scheduled workouts first, drop the column default, convert the column through a replacement enum containing only `PLANNED` and `COMPLETED`, drop the old enum, rename the replacement enum, and restore the `PLANNED` default.

- [ ] **Step 4: Regenerate Prisma and run the affected integration tests**

  Run: `npm run db:generate` followed by the Task 2 test command. Expected: Prisma generates successfully and no test creates or expects cancelled state.

- [ ] **Step 5: Commit the migration**

  ```bash
  git add prisma/schema.prisma prisma/migrations server/tests/integration
  git commit -m "feat: remove cancelled workout records"
  ```

### Task 3: Add planned-workout deletion and remove cancellation APIs

**Files:**
- Modify: `server/src/workouts/service.ts`
- Modify: `server/src/routes/workouts/route.ts`
- Modify: `client/src/api/client.ts`
- Modify: `client/src/api/contracts.ts`
- Modify: `client/src/components/calendar/WorkoutDetailsDrawer.tsx`
- Modify: `client/src/pages/calendar/CalendarPage.tsx`
- Test: `server/tests/integration/workout-log.test.ts`
- Test: `server/tests/integration/calendar.test.ts`
- Test: `client/tests/ui/calendar.test.tsx`

**Interfaces:**
- Add `WorkoutService.deletePlannedWorkout(userId: string, workoutId: string): Promise<void>`.
- Add `DELETE /workouts/:workoutId`, accepting no body and returning `{ data: null }`.
- Add `deleteWorkout(workoutId: string): Promise<void>` to the client API.
- Remove `cancelWorkout()` and every client/server cancellation route.

- [ ] **Step 1: Write failing deletion tests**

  Cover deletion of a planned workout, rejection of a completed workout, ownership checks, and cascading planned exercises/sets. Update Calendar UI tests so the drawer offers Delete only for planned workouts and does not expose Cancelled history.

- [ ] **Step 2: Run focused tests and verify the expected failures**

  Run: `npm test -- server/tests/integration/workout-log.test.ts server/tests/integration/calendar.test.ts client/tests/ui/calendar.test.tsx`

- [ ] **Step 3: Implement the deletion service and route**

  Load the user-owned workout inside a transaction, reject anything except `PLANNED`, delete it, and rely on the existing cascading relations for planned exercises and sets. Return a conflict for completed workouts.

- [ ] **Step 4: Update the details drawer and Calendar refresh flow**

  Add a confirmation action labelled `Delete planned workout`, call the new endpoint, close the drawer, reload the cycle/calendar, and show a success message. Remove cancellation labels, branches, imports, and messages.

- [ ] **Step 5: Run focused tests and commit**

  ```bash
  git add server/src/workouts client/src/api client/src/components/calendar client/src/pages/calendar server/tests client/tests
  git commit -m "feat: delete planned workouts"
  ```

### Task 4: Make Review status server-authoritative and remove cancellation reporting

**Files:**
- Modify: `shared/src/domain/cycles/review-status.ts`
- Modify: `server/src/cycles/service.ts`
- Modify: `server/src/routes/cycles/route.ts`
- Modify: `server/src/ai/weight-service.ts`
- Modify: `server/src/ai/prompts/weight.ts`
- Modify: `server/src/reviews/service.ts`
- Modify: `client/src/api/contracts.ts`
- Modify: `client/src/pages/calendar/CalendarPage.tsx`
- Modify: `client/src/pages/progress/ProgressPage.tsx`
- Modify: `client/src/features/progress/progress-model.ts`
- Modify: `client/src/styles/effects.css`
- Test: `shared/tests/domain/review-status.test.ts`
- Test: `server/tests/ai/weight-service.test.ts`
- Test: `client/tests/ui/calendar.test.tsx`

**Interfaces:**
- Extend the review status response with `reviewAvailableOn`, `daysUntilReview`, and an explicit blocked reason.
- A review remains blocked when any planned workout remains in the cycle, including after the end date.
- Review and weight recommendation contexts contain completed training facts only; no cancelled count is emitted.

- [ ] **Step 1: Write failing tests for review availability and reporting**

  Test before the end date, the end date with pending planned workouts, the end date after all workouts are completed, and post-end-date behavior with unresolved planned workouts. Assert that progress no longer renders a cancelled metric and review payloads contain no cancellation fields.

- [ ] **Step 2: Run focused tests and verify failures**

  Run: `npm test -- shared/tests/domain/review-status.test.ts server/tests/ai/weight-service.test.ts client/tests/ui/calendar.test.tsx`

- [ ] **Step 3: Implement server-side date and pending-workout rules**

  Calculate the earliest review date using the cycle timezone and expose the remaining calendar-day count. Keep the Review action disabled while planned workouts exist; do not auto-delete them during close.

- [ ] **Step 4: Remove cancellation data from AI/progress paths and update UI copy**

  Delete cancelled counts, cancellation summary objects, cancelled styles, and progress metrics. Render the Calendar Review button permanently; use a real disabled button before eligibility and a link when review is available. Display the remaining days/date supplied by the API.

- [ ] **Step 5: Run focused tests and commit**

  ```bash
  git add shared/src server/src client/src shared/tests server/tests client/tests
  git commit -m "feat: make review completion-only"
  ```

### Task 5: Add persistent Calendar action panels

**Files:**
- Create: `client/src/components/calendar/CalendarActionBar.tsx`
- Create: `client/src/components/calendar/AddSessionPanel.tsx`
- Create: `client/src/components/calendar/GenerateDayPlanPanel.tsx`
- Modify: `client/src/pages/calendar/CalendarPage.tsx`
- Modify: `client/src/components/workouts/StrengthPlanBuilder.tsx`
- Test: `client/tests/ui/calendar.test.tsx`

**Interfaces:**
- `CalendarActionBar` receives cycle/review state and one active panel key: `"add" | "generate" | null`.
- `AddSessionPanel` owns the existing manual form state and emits `onCreated`/`onClose` callbacks.
- `GenerateDayPlanPanel` receives active cycle dates and emits the selected date and focus areas through the plan API flow added in Task 6.

- [ ] **Step 1: Write failing UI tests**

  Assert that the three actions are always visible for an existing cycle, Add session opens only its compact panel, Generate plan opens only its compact panel, Review is disabled before due, and panels render left-aligned with a constrained width.

- [ ] **Step 2: Run the Calendar UI tests and verify failures**

  Run: `npm test -- client/tests/ui/calendar.test.tsx`

- [ ] **Step 3: Extract the manual Add session panel**

  Move the existing form into `AddSessionPanel`, retain StrengthPlanBuilder validation and `createWorkout`, and close/reload after success. Apply `max-w-2xl justify-self-start` rather than the previous full-width grid layout.

- [ ] **Step 4: Add the action bar and panel switching**

  Render Add session, Review cycle, and Generate plan as a left-aligned action row. Keep at most one panel open. Use accessible button states and close actions.

- [ ] **Step 5: Run focused UI tests and commit**

  ```bash
  git add client/src/components/calendar client/src/pages/calendar client/tests/ui/calendar.test.tsx
  git commit -m "feat: add persistent calendar actions"
  ```

### Task 6: Implement single-day Strength AI generation and confirmation

**Files:**
- Modify: `shared/src/domain/validation.ts` or create `shared/src/domain/plans/day-plan.ts`
- Modify: `server/src/ai/schemas.ts`
- Create: `server/src/ai/prompts/day-plan.ts`
- Modify: `server/src/ai/plan-service.ts`
- Modify: `server/src/routes/ai/plans/route.ts`
- Modify: `client/src/api/client.ts`
- Modify: `client/src/api/contracts.ts`
- Create: `client/src/components/calendar/SingleDayPlanDraftEditor.tsx`
- Modify: `client/src/components/calendar/GenerateDayPlanPanel.tsx`
- Modify: `client/src/pages/calendar/CalendarPage.tsx`
- Test: `server/tests/ai/plan-prompt.test.ts`
- Test: `server/tests/ai/plan-service.test.ts`
- Test: `client/tests/ui/calendar.test.tsx`

**Interfaces:**
- `POST /ai/plans/:cycleId/day-generate` accepts `{ scheduledDate: string; focusAreas: string[] }` and returns a one-workout `ApiPlanDraft`.
- `POST /ai/plans/:cycleId/day-confirm` accepts the validated draft and returns the created `ApiWorkout`.
- `PlanService.generateSingleDayDraft(userId, cycleId, input)` requires an active cycle and returns a Strength-only draft.
- `PlanService.confirmSingleDayDraft(userId, cycleId, input)` revalidates the draft and creates exactly one workout transactionally.

- [ ] **Step 1: Write failing prompt, service, route, and UI tests**

  Cover focus areas in the prompt, exactly one Strength workout, active-cycle ownership, date bounds, empty target date, illegal exercises, AI error behavior, explicit confirmation, and Calendar refresh after confirmation.

- [ ] **Step 2: Run focused tests and verify failures**

  Run: `npm test -- server/tests/ai/plan-prompt.test.ts server/tests/ai/plan-service.test.ts client/tests/ui/calendar.test.tsx`

- [ ] **Step 3: Add the single-day schema and prompt**

  Validate a non-empty focus-area list, reuse legal exercise selection, and require exactly one Strength workout with at least one exercise and one set. Use a new prompt version and do not reuse the weekly prompt’s seven-day instruction.

- [ ] **Step 4: Implement active-cycle draft generation**

  Load the user-owned active cycle and profile, reject dates before today or after `endDate`, query target-date workouts and reject a non-empty date, call the AI client, then validate the returned workout against the legal exercise pool without persisting it.

- [ ] **Step 5: Implement explicit draft confirmation**

  Recheck ownership, active status, date bounds, empty target date, Strength content, and legal exercises in a transaction before creating the scheduled workout and nested planned exercises/sets.

- [ ] **Step 6: Build the draft editor and connect Calendar state**

  Let the user review/edit the single-day draft, confirm it, close the panel, reload the cycle and calendar, and preserve the draft on validation errors rather than silently writing data.

- [ ] **Step 7: Run focused tests and commit**

  ```bash
  git add shared/src server/src client/src shared/tests server/tests client/tests
  git commit -m "feat: generate confirmed single-day strength plans"
  ```

### Task 7: Remove remaining cancellation references and perform final verification

**Files:**
- Modify or delete every remaining file returned by `rg -n "CANCELLED|cancelWorkout|cancelled|restoreCancelled" client server shared prisma`
- Modify: affected tests and documentation under `docs/`

- [ ] **Step 1: Search for stale cancellation references**

  Run: `rg -n "CANCELLED|cancelWorkout|cancelled|restoreCancelled" client server shared prisma docs`

  Expected: no product-code references remain; migration history may mention the old enum only in historical migration SQL and the new migration’s cleanup statement.

- [ ] **Step 2: Update or remove stale tests and UI copy**

  Replace progress/review assertions with completed-only behavior and remove any obsolete restoration/cancellation fixtures.

- [ ] **Step 3: Run the complete verification commands**

  Run:

  ```bash
  npm test
  npm run typecheck
  npm run build --workspace @fitness/client
  npm run build --workspace @fitness/server
  git diff --check
  ```

  Expected: all tests that do not require an external database pass, typecheck and both builds succeed, and `git diff --check` is clean.

- [ ] **Step 4: Review migration and working tree**

  Confirm the migration deletes only `CANCELLED` scheduled workouts, completed rows are untouched, the final tree has no uncommitted accidental files, and the plan/spec documents are included intentionally.

- [ ] **Step 5: Commit the final cleanup**

  ```bash
  git add .
  git commit -m "chore: complete calendar workout lifecycle cleanup"
  ```
