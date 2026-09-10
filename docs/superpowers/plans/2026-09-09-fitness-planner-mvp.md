# GymBud Fitness Planner MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-first four-week fitness planner with calendar scheduling, location-aware exercises, per-set strength logs, AI recommendations, and immutable cycle reviews.

**Architecture:** Use an npm-workspaces monorepo with a React + Vite responsive web client, a Node.js + Express REST API, and a shared TypeScript domain package. Keep domain rules and API schemas in `shared`, persistence and AI calls in `server`, and browser UI in `client`. Reserve `mobile` for a later Expo/React Native iOS client that consumes the same API and shared business contracts.

**Tech Stack:** React, Vite, React Router, TypeScript, Node.js, Express, Prisma, PostgreSQL, Zod, Tailwind CSS, OpenAI-compatible AI client, Vitest, React Testing Library, and Playwright. Future mobile: Expo, React Native, and Expo Router.

**Spec:** `docs/superpowers/specs/2026-09-09-fitness-planner-mvp-design.md`

## Global Constraints

- Activity types are exactly `STRENGTH`, `CARDIO`, and `SPORT`.
- Locations are exactly `GYM` and `HOME`.
- Workout statuses are exactly `PLANNED`, `COMPLETED`, and `CANCELLED`.
- A strength exercise may be tagged for both locations only when it does not require equipment.
- RPE and post-workout subjective feedback are not stored.
- Backfilled completion requires an actual date and time; future completion timestamps are rejected.
- AI output is never trusted without Zod validation and database ownership/location checks.
- AI cannot modify historical records or insert an unreviewed plan into the calendar.
- Raw cycle-review user text is never persisted; only the AI-processed summary and conclusions are stored.
- Closed cycles are read-only after the next cycle is generated.
- Original planned completion and extra-workout completion are reported separately.
- The first implementation uses a seeded current-user adapter; every query still filters by `ownerId` so a real authentication provider can replace it later without changing domain services.
- `client` never imports Prisma or server-only modules.
- `shared` contains no `window`, DOM, React DOM, Express, Prisma, or Node-only imports.
- The future iOS client consumes the same JSON API; it does not duplicate workout or cycle business rules.
- Web and mobile UI components are allowed to differ; only domain logic, validation, API contracts, and data-fetching helpers are shared.

---

### Task 1: Scaffold the application and domain primitives

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `client/package.json`
- Create: `client/vite.config.ts`
- Create: `server/package.json`
- Create: `server/src/index.ts`
- Create: `server/src/routes/index.ts`
- Create: `shared/package.json`
- Create: `shared/src/index.ts`
- Create: `shared/src/api/contracts.ts`
- Create: `shared/src/api/client.ts`
- Create: `vitest.config.ts`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`
- Create: `client/src/router.tsx`
- Create: `client/src/api/client.ts`
- Create: `shared/src/domain/enums.ts`
- Create: `shared/src/domain/types.ts`
- Create: `shared/src/domain/validation.ts`
- Create: `server/src/config/env.ts`
- Create: `shared/tests/domain/validation.test.ts`

**Interfaces:**
- `shared/src/domain/enums.ts` exports `ActivityType`, `Location`, `WorkoutStatus`, `WorkoutSource`, and `CycleStatus`.
- `server/src/config/env.ts` exports validated environment configuration for the API URL, database URL, AI key, and `DEMO_USER_ID`.
- `shared/src/domain/validation.ts` exports Zod schemas `profileInputSchema`, `scheduledWorkoutInputSchema`, `plannedSetSchema`, and `setLogSchema`.
- The shared package name is `@fitness/shared`; the client and server import shared code through that package name, never through filesystem paths.
- `shared/src/api/client.ts` exports a platform-neutral `ApiClient` based on `fetch`; the web and future mobile clients may wrap it without duplicating endpoint contracts.
- `client/src/router.tsx` owns web routes only; it must not be imported by the future mobile app.

- [ ] **Step 1: Write the failing domain-validation tests**

```ts
import { describe, expect, it } from "vitest";
import { profileInputSchema, setLogSchema } from "@fitness/shared/domain/validation";

describe("domain validation", () => {
  it("accepts the minimum profile scheduling inputs", () => {
    expect(profileInputSchema.parse({
      weeklyTrainingDays: 3,
      sessionDurationMinutes: 60,
      defaultLocation: "GYM",
      primaryGoal: "FAT_LOSS",
    })).toMatchObject({ weeklyTrainingDays: 3 });
  });

  it("rejects an RPE field", () => {
    expect(() => setLogSchema.parse({ weight: 40, reps: 8, rpe: 7 })).toThrow();
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- shared/tests/domain/validation.test.ts`

Expected: FAIL because the project and schemas do not exist.

- [ ] **Step 3: Add the workspace configuration and schemas**

Configure npm workspaces for `client`, `server`, and `shared`. Configure Vite for the client, a TypeScript Express entry point for the server, and a package export for `@fitness/shared`. Use these enum values and reject unknown fields:

```ts
export const activityTypes = ["STRENGTH", "CARDIO", "SPORT"] as const;
export const locations = ["GYM", "HOME"] as const;
export const workoutStatuses = ["PLANNED", "COMPLETED", "CANCELLED"] as const;

export const profileInputSchema = z.object({
  weeklyTrainingDays: z.number().int().min(1).max(7),
  sessionDurationMinutes: z.number().int().min(10).max(360),
  defaultLocation: z.enum(locations),
  primaryGoal: z.string().min(1),
  secondaryOutcome: z.string().min(1).optional(),
}).strict();
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- shared/tests/domain/validation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the scaffold**

```bash
git init
git add package.json tsconfig.json client server shared vitest.config.ts
git commit -m "chore: scaffold fitness planner domain"
```

### Task 2: Add the database schema and seeded current user

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/seed.ts`
- Create: `server/src/db.ts`
- Create: `server/src/current-user.ts`
- Create: `server/tests/integration/seed.test.ts`
- Modify: `package.json`

**Interfaces:**
- `db` exports a singleton `PrismaClient`.
- `seedDemoUser(): Promise<{ userId: string }>` creates one demo user and profile.
- `getCurrentUserId(): Promise<string>` returns only the seeded/demo user ID in MVP mode.

- [ ] **Step 1: Write the failing schema integration test**

```ts
it("seeds a user with a profile and no cycles", async () => {
  const result = await seedDemoUser();
  const user = await db.user.findUnique({
    where: { id: result.userId },
    include: { profile: true, cycles: true },
  });
  expect(user?.profile?.defaultLocation).toBe("GYM");
  expect(user?.cycles).toHaveLength(0);
});
```

- [ ] **Step 2: Run the integration test and verify it fails**

Run: `npm test -- server/tests/integration/seed.test.ts`

Expected: FAIL because Prisma models and seed code do not exist.

- [ ] **Step 3: Implement the Prisma models**

Create models for `User`, `UserProfile`, `TrainingCycle`, `ScheduledWorkout`, `PlannedExercise`, `PlannedSet`, `WorkoutLog`, `ExerciseLog`, `SetLog`, `Exercise`, `AIRecommendation`, and `CycleReviewSnapshot`.

Required constraints:

```prisma
enum ActivityType { STRENGTH CARDIO SPORT }
enum Location { GYM HOME }
enum WorkoutStatus { PLANNED COMPLETED CANCELLED }
enum WorkoutSource { ORIGINAL EXTRA }
enum CycleStatus { DRAFT ACTIVE CLOSED }
```

Add unique ownership-safe identifiers and indexes on `(userId, scheduledDate)`, `(cycleId, status)`, `(ownerId, name)`, and `(exerciseId, createdAt)`.

The minimum persisted fields are:

```text
User: id, email, createdAt
UserProfile: userId, primaryGoal, secondaryOutcome, weeklyTrainingDays,
  sessionDurationMinutes, defaultLocation
TrainingCycle: id, userId, startDate, endDate, timezone, status, closedAt
ScheduledWorkout: id, userId, cycleId, activityType, scheduledDate,
  location, durationMinutes, status, source, completedAt, createdAt
PlannedExercise: id, workoutId, exerciseId, sortOrder, restSeconds
PlannedSet: id, plannedExerciseId, setNumber, targetReps, plannedWeight,
  weightUnit
WorkoutLog: id, workoutId, createdAt, updatedAt
ExerciseLog: id, workoutLogId, exerciseId, sortOrder
SetLog: id, exerciseLogId, setNumber, actualReps, actualWeight, weightUnit
Exercise: id, ownerId nullable, name, equipment, targetMuscles,
  movementPattern, availableLocations, aiEligible, createdAt
AIRecommendation: id, userId, exerciseId nullable, workoutId nullable,
  kind, recommendedWeight, reason, status, createdAt
CycleReviewSnapshot: id, cycleId unique, processedSummary nullable,
  objectiveSummary, conclusions, nextCycleDraft, createdAt
```

- [ ] **Step 4: Create and run the migration and seed**

Run: `npm run db:migrate -- --name init_gymbud` and then `npm run db:seed`.

Expected: the database contains one demo user, one profile, and no planned workouts.

- [ ] **Step 5: Run the integration test and verify it passes**

Run: `npm test -- server/tests/integration/seed.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the persistence foundation**

```bash
git add prisma server/src package.json server/tests/integration
git commit -m "feat: add fitness planner persistence schema"
```

### Task 3: Implement deterministic scheduling and cycle lifecycle rules

**Files:**
- Create: `shared/src/domain/scheduling/distribute-week.ts`
- Create: `shared/src/domain/cycles/close-cycle.ts`
- Create: `server/src/cycles/service.ts`
- Create: `server/src/routes/cycles/route.ts`
- Create: `server/src/routes/cycles/[cycleId]/close/route.ts`
- Create: `server/src/routes/cycles/[cycleId]/restore-workout/route.ts`
- Create: `shared/tests/domain/scheduling.test.ts`
- Create: `shared/tests/domain/close-cycle.test.ts`

**Interfaces:**
- `distributeFirstWeek(start: Date, trainingDays: number): Date[]`
- `closeCycle(input: CloseCycleInput, now: Date): CloseCycleResult`
- `CycleService.createDraft(userId, profileWithTimezone): Promise<CycleDraft>`
- `CycleService.activateDraft(userId, cycleId, timezone): Promise<ActiveCycle>`
- `CycleService.getReviewStatus(userId, cycleId): Promise<CycleReviewStatus>`
- `CycleService.close(userId, cycleId, now): Promise<ClosedCycleResult>`

- [x] **Step 1: Write failing scheduling tests**

```ts
it("distributes three sessions over the next seven days", () => {
  const dates = distributeFirstWeek(new Date("2026-09-09T00:00:00Z"), 3);
  expect(dates.map(d => d.toISOString().slice(0, 10))).toEqual([
    "2026-09-09", "2026-09-12", "2026-09-15",
  ]);
});
```

- [x] **Step 2: Write failing cycle-close tests**

Cover these cases: unresolved planned workout becomes cancelled in the old cycle; an auto-cancelled workout can be restored before the next cycle exists; restoration is rejected after closure; a backfilled workout requires `completedAt`; a cycle with zero completed workouts becomes `CLOSED` with `RESET_REQUIRED`; a closed cycle rejects later writes.

- [x] **Step 3: Run the domain tests and verify they fail**

Run: `npm test -- shared/tests/domain/scheduling.test.ts shared/tests/domain/close-cycle.test.ts`

Expected: FAIL because scheduling and closure functions do not exist.

- [x] **Step 4: Implement pure scheduling and closure functions**

The closure function must return a transaction plan containing the old cycle status, cancelled workout IDs, immutable objective summary, and whether a next-cycle draft may be generated. It must not call the AI client.

- [x] **Step 5: Implement transactional server services and routes**

The close route must re-check ownership and cycle status inside the transaction. It must reject any write to a `CLOSED` cycle and must never move auto-cancelled workouts into the new cycle.

- [x] **Step 6: Run tests and commit**

Run: `npm test -- shared/tests/domain/scheduling.test.ts shared/tests/domain/close-cycle.test.ts`.

Expected: PASS.

```bash
git add shared/src/domain/cycles shared/src/domain/scheduling server/src/cycles server/src/routes/cycles shared/tests/domain
git commit -m "feat: add cycle scheduling and closure rules"
```

### Task 4: Implement location-aware exercise library

**Files:**
- Create: `shared/src/domain/exercises/location.ts`
- Create: `shared/src/domain/exercises/validation.ts`
- Create: `server/src/exercises/service.ts`
- Create: `server/src/routes/exercises/route.ts`
- Create: `server/src/routes/exercises/[exerciseId]/route.ts`
- Create: `client/src/components/exercises/ExercisePicker.tsx`
- Create: `shared/tests/domain/exercise-location.test.ts`
- Create: `server/tests/integration/exercises.test.ts`

**Interfaces:**
- `isExerciseAvailableAtLocation(exercise, location): boolean`
- `validateExerciseLocations(equipment, availableLocations): void`
- `listAvailableExercises(userId, location): Promise<Exercise[]>`
- `createConfirmedCustomExercise(userId, input): Promise<Exercise>`

- [x] **Step 1: Write failing location tests**

```ts
it("allows bodyweight exercises in both locations", () => {
  expect(() => validateExerciseLocations("NONE", ["GYM", "HOME"])).not.toThrow();
});

it("rejects an equipment exercise tagged HOME", () => {
  expect(() => validateExerciseLocations("BARBELL", ["HOME"])).toThrow();
});
```

- [x] **Step 2: Run the tests and verify they fail**

Run: `npm test -- shared/tests/domain/exercise-location.test.ts`

Expected: FAIL because the location functions do not exist.

- [x] **Step 3: Implement location validation and ownership filtering**

The query must return system exercises plus the current user's confirmed custom exercises, and must filter both by `aiEligible` only when the caller is generating an AI plan. Never return another user's custom exercise.

- [x] **Step 4: Add system seed exercises and custom-exercise routes**

Seed bodyweight examples with both locations and equipment examples with `GYM` only. The custom-exercise endpoint accepts user-confirmed metadata; unconfirmed AI extraction is not persisted.

- [x] **Step 5: Implement the picker behavior**

`ExercisePicker` receives `location` and renders only exercises returned for that location. When a workout location changes, incompatible planned exercises are marked but not silently replaced.

- [x] **Step 6: Run tests and commit**

Run: `npm test -- shared/tests/domain/exercise-location.test.ts server/tests/integration/exercises.test.ts`.

Expected: PASS.

```bash
git add prisma shared/src/domain/exercises server/src/exercises server/src/routes/exercises client/src/components/exercises server/tests/integration shared/tests/domain
git commit -m "feat: add location-aware exercise library"
```

### Task 5: Implement workout state transitions and per-set logging

**Files:**
- Create: `shared/src/domain/workouts/state-machine.ts`
- Create: `server/src/workouts/service.ts`
- Create: `server/src/routes/workouts/[workoutId]/complete/route.ts`
- Create: `server/src/routes/workouts/[workoutId]/cancel/route.ts`
- Create: `server/src/routes/workouts/[workoutId]/reschedule/route.ts`
- Create: `server/src/routes/workouts/[workoutId]/route.ts`
- Create: `server/src/routes/workouts/route.ts`
- Create: `server/src/routes/workouts/[workoutId]/log/route.ts`
- Create: `client/src/components/workouts/StrengthLogForm.tsx`
- Create: `client/src/components/workouts/CardioLogForm.tsx`
- Create: `client/src/components/workouts/SportLogForm.tsx`
- Create: `shared/tests/domain/workout-state.test.ts`
- Create: `server/tests/integration/workout-log.test.ts`

**Interfaces:**
- `completeWorkout(workout, input, now): CompletedWorkout`
- `cancelWorkout(workout): CancelledWorkout`
- `rescheduleWorkout(workout, newDate): PlannedWorkout`
- `updateWorkoutLocation(workout, location): PlannedWorkout`
- `createExtraWorkout(userId, input): Promise<ScheduledWorkout>`
- `validateCompletionTimestamp(completedAt, now): void`
- `saveWorkoutLog(userId, workoutId, input): Promise<WorkoutLog>`

- [ ] **Step 1: Write failing transition tests**

Cover normal completion, backfill with an explicit past timestamp, future timestamp rejection, cancellation, rescheduling, changing the location of one workout, creating an extra workout, closed-cycle rejection, and editing an existing log without creating a second log.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm test -- shared/tests/domain/workout-state.test.ts server/tests/integration/workout-log.test.ts`

Expected: FAIL because the state machine and services do not exist.

- [ ] **Step 3: Implement the pure state machine**

`completeWorkout` must require `completedAt` for any user-provided completion. The server may supply the current timestamp for an immediate completion action, but a backfill request must always include an explicit timestamp. Reject timestamps after `now`.

- [ ] **Step 4: Implement per-set persistence**

Persist planned sets separately from actual sets. Use upsert semantics for a user's edit of an existing actual log. Do not expose a delete mutation for completed workout logs.

- [ ] **Step 5: Add activity-specific validation**

Strength accepts set logs; cardio accepts duration and optional distance/pace; sport accepts duration, intensity category, and notes. Reject RPE fields from every API schema.

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- shared/tests/domain/workout-state.test.ts server/tests/integration/workout-log.test.ts`.

Expected: PASS.

```bash
git add shared/src/domain/workouts server/src/workouts server/src/routes/workouts client/src/components/workouts server/tests/integration shared/tests/domain
git commit -m "feat: add workout state transitions and logging"
```

### Task 6: Add the validated AI provider and four-week plan drafts

**Files:**
- Create: `server/src/ai/client.ts`
- Create: `server/src/ai/fake-client.ts`
- Create: `server/src/ai/schemas.ts`
- Create: `server/src/ai/prompts/plan.ts`
- Create: `server/src/ai/plan-service.ts`
- Create: `server/src/routes/ai/plans/route.ts`
- Create: `server/tests/ai/plan-service.test.ts`

**Interfaces:**
- `AiClient.generateJson<T>(request: AiRequest, schema: ZodSchema<T>): Promise<T>`
- `PlanService.generateDraft(userId, cycleId): Promise<PlanDraft>`
- `PlanService.confirmDraft(userId, cycleId, edits): Promise<TrainingCycle>`

- [ ] **Step 1: Write failing AI-service tests using the fake client**

```ts
it("passes only legal exercises for the workout location", async () => {
  const result = await planService.generateDraft(userId, cycleId);
  expect(result.workouts.flatMap(w => w.exercises)
    .every(e => e.availableLocations.includes("HOME"))).toBe(true);
});
```

Also test that malformed model JSON, another user's exercise ID, and an empty exercise list for a strength workout are rejected without writing calendar rows.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm test -- server/tests/ai/plan-service.test.ts`

Expected: FAIL because the AI adapter and plan service do not exist.

- [ ] **Step 3: Define structured request and response schemas**

The response must include activity type, date, duration, location, and activity-specific details. Strength responses include exercises, planned sets, repetitions, and rest; they do not include RPE. The schema must reject unknown exercise IDs and invalid locations after parsing.

- [ ] **Step 4: Implement the provider adapter**

Keep the model name and prompt version in the request metadata. Use `fake-client.ts` for deterministic tests; production uses the configured AI API client through the same interface.

- [ ] **Step 5: Implement draft persistence and confirmation**

Save an AI-generated draft as draft data only. On confirmation, create the scheduled workouts in one transaction. A failed confirmation must leave the calendar unchanged.

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- server/tests/ai/plan-service.test.ts`.

Expected: PASS.

```bash
git add server/src/ai server/src/routes/ai/plans server/tests/ai
git commit -m "feat: add validated AI plan drafts"
```

### Task 7: Add custom-exercise extraction, replacements, and weight recommendations

**Files:**
- Create: `server/src/ai/prompts/exercise.ts`
- Create: `server/src/ai/prompts/weight.ts`
- Create: `server/src/ai/exercise-service.ts`
- Create: `server/src/ai/weight-service.ts`
- Create: `server/src/routes/ai/exercises/extract/route.ts`
- Create: `server/src/routes/ai/workouts/[workoutId]/replace/route.ts`
- Create: `server/src/routes/ai/exercises/[exerciseId]/weight/route.ts`
- Create: `server/tests/ai/exercise-service.test.ts`
- Create: `server/tests/ai/weight-service.test.ts`

**Interfaces:**
- `extractExerciseMetadata(input): Promise<ExerciseMetadataDraft>`
- `getCompatibleReplacements(userId, workoutId, exerciseId): Promise<ReplacementOption[]>`
- `recommendNextWeight(userId, exerciseId, nextWorkoutId): Promise<WeightRecommendation>`
- `applyWeightDecision(userId, recommendationId, decision): Promise<ScheduledWorkout>`

- [ ] **Step 1: Write failing tests for legal custom metadata**

Test that equipment-bearing AI output cannot be confirmed with `HOME`, and that an unconfirmed custom exercise is not included in the AI-eligible pool.

- [ ] **Step 2: Write failing tests for weight context and scope**

Test that the context contains at most the latest five same-exercise records, the current-cycle summary, all-time best, goal, and next target. Test that accepting a recommendation changes only the next matching workout.

- [ ] **Step 3: Run the tests and verify they fail**

Run: `npm test -- server/tests/ai/exercise-service.test.ts server/tests/ai/weight-service.test.ts`

Expected: FAIL because the services do not exist.

- [ ] **Step 4: Implement context builders and schemas**

The context builder must label planned original logs as primary evidence and extra logs as secondary evidence. No raw cycle-review prompt may be included in weight context.

- [ ] **Step 5: Implement user-decision writes**

Accept and modified decisions write the chosen recommendation to the next workout. Rejection leaves an existing scheduled weight unchanged and otherwise leaves it blank. No mutation may update a historical `SetLog`.

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- server/tests/ai/exercise-service.test.ts server/tests/ai/weight-service.test.ts`.

Expected: PASS.

```bash
git add server/src/ai server/src/routes/ai server/tests/ai
git commit -m "feat: add exercise replacement and weight recommendations"
```

### Task 8: Implement cycle review, optional summary, and next-cycle draft

**Files:**
- Create: `shared/src/domain/reviews/objective-summary.ts`
- Create: `server/src/ai/prompts/review.ts`
- Create: `server/src/reviews/service.ts`
- Create: `server/src/routes/cycles/[cycleId]/review/route.ts`
- Create: `server/src/routes/cycles/[cycleId]/next-draft/route.ts`
- Create: `client/src/components/reviews/CycleReviewForm.tsx`
- Create: `shared/tests/domain/objective-summary.test.ts`
- Create: `server/tests/integration/cycle-review.test.ts`

**Interfaces:**
- `buildObjectiveCycleSummary(cycleId): Promise<ObjectiveCycleSummary>`
- `generateCycleReview(userId, cycleId, optionalSummary): Promise<CycleReviewResult>`
- `generateNextCycleDraft(userId, cycleId, reviewId): Promise<NextCycleDraft>`

- [ ] **Step 1: Write failing objective-summary tests**

Test planned completion rate, extra-workout counts, cancellations, reschedules, planned-versus-actual strength data, cardio duration/distance, and zero-completed-cycle detection.

- [ ] **Step 2: Write failing review integration tests**

Cover an empty optional summary, a supplied summary, raw-summary absence from persisted rows, processed-summary persistence, and direct AI-result persistence.

- [ ] **Step 3: Run the tests and verify they fail**

Run: `npm test -- shared/tests/domain/objective-summary.test.ts server/tests/integration/cycle-review.test.ts`

Expected: FAIL because the review services do not exist.

- [ ] **Step 4: Implement review generation**

Build the objective summary from database rows. Add the optional user text to the AI request only when supplied. Do not write the raw text to `CycleReviewSnapshot`, logs, or an AI history table. Save only the processed summary, conclusions, and generated next-cycle draft.

- [ ] **Step 5: Enforce cycle closure ordering**

The service must resolve unresolved workouts and save the old-cycle snapshot before creating a next-cycle draft. If the cycle has zero completed workouts, save a `CLOSED` objective snapshot with `RESET_REQUIRED` eligibility and do not generate a calendar draft.

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- shared/tests/domain/objective-summary.test.ts server/tests/integration/cycle-review.test.ts`.

Expected: PASS.

```bash
git add shared/src/domain/reviews server/src/ai/prompts/review.ts server/src/reviews server/src/routes/cycles client/src/components/reviews server/tests/integration shared/tests/domain
git commit -m "feat: add cycle review and next-cycle drafts"
```

### Task 9: Build the core user interface

**Files:**
- Create: `client/src/pages/onboarding/OnboardingPage.tsx`
- Create: `client/src/pages/calendar/CalendarPage.tsx`
- Create: `client/src/pages/workouts/WorkoutPage.tsx`
- Create: `client/src/pages/review/ReviewPage.tsx`
- Create: `client/src/components/onboarding/ProfileForm.tsx`
- Create: `client/src/components/calendar/CalendarGrid.tsx`
- Create: `client/src/components/calendar/WorkoutCard.tsx`
- Create: `client/src/components/workouts/WorkoutEditor.tsx`
- Create: `client/src/components/workouts/LocationSelector.tsx`
- Create: `client/src/components/review/NextCycleDraftEditor.tsx`
- Create: `client/tests/ui/calendar.test.tsx`
- Create: `client/tests/ui/review.test.tsx`

**Interfaces:**
- Pages load data through server route handlers and submit only validated payloads.
- `WorkoutEditor` receives `workout`, `location`, and legal exercise options.
- `NextCycleDraftEditor` receives an AI draft and returns explicit user confirmation before calendar insertion.

- [ ] **Step 1: Write failing UI tests**

Test that a calendar card shows overdue status, that changing location filters exercises, that backfill displays required date/time controls, and that a next-cycle draft has a separate confirmation action.

- [ ] **Step 2: Run the UI tests and verify they fail**

Run: `npm test -- client/tests/ui/calendar.test.tsx client/tests/ui/review.test.tsx`

Expected: FAIL because pages and components do not exist.

- [ ] **Step 3: Implement onboarding and calendar pages**

Onboarding collects weekly days, session duration, default location, and goal fields. The calendar supports manual add, date change, cancel, location override, and status display without automatically modifying other workouts.

- [ ] **Step 4: Implement workout logging screens**

Render activity-specific forms. Strength renders planned sets and actual set inputs; cardio and sport render their objective fields. Backfill completion requires date and time inputs and rejects future values before submission.

- [ ] **Step 5: Implement the review and draft editor**

The review summary textarea is optional. The UI must not claim that the original text is saved. The generated review result saves directly, while the next-cycle draft remains unconfirmed until the user edits or confirms it.

- [ ] **Step 6: Run UI tests and commit**

Run: `npm test -- client/tests/ui/calendar.test.tsx client/tests/ui/review.test.tsx`.

Expected: PASS.

```bash
git add client/src client/tests/ui
git commit -m "feat: add calendar workout and review interfaces"
```

### Task 10: Add end-to-end coverage and release checks

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/first-cycle.spec.ts`
- Create: `tests/e2e/backfill-and-close.spec.ts`
- Create: `tests/e2e/location-replacement.spec.ts`
- Create: `docs/mobile-readiness.md`
- Create: `README.md`
- Modify: `package.json`

- [ ] **Step 1: Write the first-cycle end-to-end test**

The test must create a profile, generate a draft through the fake AI client, confirm it, complete one strength workout with actual set data, and verify the calendar status becomes `COMPLETED`.

- [ ] **Step 2: Write the closure and backfill end-to-end test**

The test must leave one workout unresolved, open review, verify the reminder, submit no backfill, close the cycle, and verify the unresolved workout is `CANCELLED` in the old cycle and the old cycle cannot be edited.

- [ ] **Step 3: Write the location-replacement end-to-end test**

The test must change a gym workout to home, verify equipment exercises are marked incompatible, replace one with a bodyweight exercise, and verify other workouts and the exercise library are unchanged.

- [ ] **Step 4: Run all verification commands**

Run:

```bash
npm run lint
npm test -- --run
npm run test:e2e
npx prisma validate
npx tsc --noEmit
```

Expected: all commands exit successfully.

- [ ] **Step 5: Document the future iOS boundary**

In `docs/mobile-readiness.md`, document that a future `mobile/` Expo app will import `@fitness/shared`, use the same JSON API and `shared/src/api/client.ts`, and implement its own React Native screens. State that `client/src/router.tsx` and DOM components are web-only, while any future platform-specific utility must use `.native.ts` or `.ios.ts` beside a platform-neutral implementation.

- [ ] **Step 6: Document local setup and commit**

Document required environment variables, database migration, seed commands, fake-AI mode, and the production AI-provider boundary in `README.md`.

```bash
git add playwright.config.ts tests/e2e docs/mobile-readiness.md README.md package.json
git commit -m "test: verify fitness planner MVP flows"
```

## Verification checklist

Before implementation is declared complete, verify every acceptance criterion in the design specification maps to at least one unit, integration, or end-to-end test. In particular, confirm:

- no API accepts or persists RPE;
- raw review text is absent from all persisted review records;
- an AI failure leaves calendar and historical records unchanged;
- auto-cancellation belongs to the old cycle;
- a closed cycle rejects all edit mutations;
- custom exercises are filtered by owner;
- equipment-required exercises cannot be tagged `HOME`;
- only the next matching workout receives an accepted weight recommendation.
