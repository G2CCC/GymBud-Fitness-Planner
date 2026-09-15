# Unified Planned Workouts and Profile Context Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

Goal: Remove workout source classifications and add validated body context to user profiles and AI plan prompts.

Architecture: Keep ScheduledWorkout as the single planned-calendar entity and keep actual execution data in the existing workout-log hierarchy. Add nullable normalized profile fields at the shared validation boundary, pass them through the server profile service into the plan prompt, and preserve missing values as optional context.

Tech Stack: React/Vite, Node/Express, Prisma/PostgreSQL/Supabase, TypeScript, Zod, Vitest.

Spec: docs/superpowers/specs/2026-09-15-unified-plans-profile-context-design.md

## Global Constraints

- Do not add or retain a workout source classification.
- Do not delete existing scheduled workout rows during migration.
- Store height in centimeters and body weight in kilograms.
- New body fields are optional and must not block plan generation.
- Do not implement weekly or four-cycle review aggregation in this phase.
- Do not stage environment files or generated database artifacts.

---

### Task 1: Shared domain and API contract cleanup

Files:

- Modify: shared/src/domain/enums.ts
- Modify: shared/src/domain/validation.ts
- Modify: shared/src/domain/types.ts
- Modify: shared/src/domain/reviews/objective-summary.ts
- Modify: shared/src/index.ts if exports require updating
- Modify: client/src/api/contracts.ts
- Modify: client/src/api/validation.ts
- Modify: client/src/components/onboarding/ProfileForm.tsx
- Create: client/tests/ui/onboarding.test.tsx
- Create: shared/tests/domain/profile-validation.test.ts
- Modify: shared/tests/domain/objective-summary.test.ts

Interfaces:

- ProfileInput exposes optional gender, age, heightCm, and weightKg.
- WorkoutSource and source properties are removed from shared workout types.
- Review input types no longer require a source field.

- [x] Step 1: Write failing validation and source-free tests

Add tests that assert:

```
ts
expect(profileInputSchema.parse({
  primaryGoal: "FAT_LOSS",
  weeklyTrainingDays: 3,
  sessionDurationMinutes: 60,
  defaultLocation: "GYM",
  gender: "MALE",
  age: 27,
  heightCm: 178,
  weightKg: 82,
})).toMatchObject({ age: 27, heightCm: 178, weightKg: 82 });

expect(() => profileInputSchema.parse({
  primaryGoal: "FAT_LOSS",
  weeklyTrainingDays: 3,
  sessionDurationMinutes: 60,
  defaultLocation: "GYM",
  age: 12,
})).toThrow();
```

Update the objective-summary fixture so a workout has no source property and the summary still accepts it.

- [x] Step 2: Run the focused shared tests and verify RED

Run:

```
bash
npm test -- shared/tests/domain/profile-validation.test.ts shared/tests/domain/objective-summary.test.ts
```

Expected: FAIL because the new profile fields and source-free review input are not implemented.

- [x] Step 3: Implement the shared contract changes

Add the optional profile fields and their bounds. Remove workoutSources, WorkoutSource, and source-based review fields. Remove extra-workout-specific summary branches while preserving the existing non-source objective summary behavior until the volume-review phase.

- [x] Step 4: Run the focused shared tests and verify GREEN

Run the same command from Step 2. Expected: PASS.

- [x] Step 5: Run shared typecheck

Run:

```
bash
npm run typecheck --workspace @fitness/shared
```

Expected: PASS.

---

### Task 2: Prisma profile and scheduled-workout migration

Files:

- Modify: prisma/schema.prisma
- Create via Prisma: `prisma/migrations/*_unify_plans_add_profile_context/migration.sql`
- Modify: server/src/current-user.ts (the demo-user seed profile)
- Modify: server/src/routes/profile/route.ts only if Prisma-generated field typing requires changes
- Modify: server/tests/integration/seed.test.ts
- Modify: server/tests/integration/exercises.test.ts or other fixtures that provide source

Interfaces:

- UserProfile persists nullable gender, age, heightCm, and weightKg.
- ScheduledWorkout has no source column.
- Existing workouts remain owned by their existing cycle and user.

- [x] Step 1: Add database-facing failing fixture assertions

Extend the seed/integration assertions to expect the new nullable profile fields on the seeded profile and remove source from created workout fixtures.

- [x] Step 2: Run the focused database tests

Run:

```
bash
npm test -- --testTimeout=30000 server/tests/integration/seed.test.ts server/tests/integration/workout-log.test.ts
```

When DATABASE_URL is absent, record that the database-gated tests are skipped; the schema and TypeScript checks remain mandatory.

This workspace has no `DATABASE_URL`, so the integration suite records these
tests as skipped.

- [x] Step 3: Modify the Prisma schema

Add a nullable Gender enum and nullable profile fields. Remove the WorkoutSource enum and ScheduledWorkout.source.

- [x] Step 4: Create and inspect the migration

Run:

```
bash
npm run db:generate
npm run db:migrate -- --name unify_plans_add_profile_context
```

The Prisma Client was generated and the migration SQL was inspected. Because
this workspace has no Supabase connection, the migration file is committed as
deployable SQL rather than applied here. It adds nullable profile columns and
removes only the source enum/column. Do not use a destructive reset.

- [x] Step 5: Update seed data

Seed deterministic example profile values for the demo user so the prompt can be tested locally, while retaining nullable behavior for other users.

- [x] Step 6: Run database-facing typecheck

Run:

```
bash
npm run typecheck --workspace @fitness/server
npx prisma validate --schema prisma/schema.prisma
```

Expected: PASS when the configured Supabase environment supplies DATABASE_URL and DIRECT_URL.

---

### Task 3: AI plan prompt body context

Files:

- Modify: server/src/ai/prompts/plan.ts
- Modify: server/src/ai/plan-service.ts
- Modify: server/src/ai/schemas.ts only if the prompt context contract requires a shared schema
- Modify: server/tests/ai/plan-service.test.ts
- Create or modify: server/tests/ai/plan-prompt.test.ts

Interfaces:

- buildPlanRequest receives optional body context from the profile.
- The serialized prompt includes supplied demographic fields.
- A profile with null body fields still creates a valid plan request.

- [x] Step 1: Write failing prompt tests

Test that a supplied profile produces prompt context containing age, gender, height, and weight, and that null values are not serialized as fabricated values.

- [x] Step 2: Run the focused AI tests and verify RED

Run:

```
bash
npm test -- server/tests/ai/plan-prompt.test.ts server/tests/ai/plan-service.test.ts
```

Expected: FAIL because the prompt request does not yet contain the new profile context.

- [x] Step 3: Pass profile context through the plan service

Select the four new fields with the existing profile query and pass them to buildPlanRequest. Serialize only non-null values with stable field names and metric units.

- [x] Step 4: Update the prompt instructions

Tell the model that body data is optional planning context and must not be used to invent medical diagnoses, nutrition prescriptions, or unsupported safety claims.

- [x] Step 5: Run the focused AI tests and verify GREEN

Run the same command from Step 2. Expected: PASS.

---

### Task 4: Phase verification and integration commit

Files:

- Modify: docs/development/ai-plans.md if the prompt contract needs documentation
- Modify: docs/superpowers/plans/2026-09-15-unified-plans-profile-context.md to mark completed steps

- [x] Step 1: Run the full test suite

Run:

```
bash
npm test -- --testTimeout=30000
```

Expected: no failing tests. Database-gated tests may remain skipped only when the environment has no DATABASE_URL.

- [x] Step 2: Run typecheck and client build

Run:

```
bash
npm run typecheck
npm run build --workspace @fitness/client
git diff --check
```

- [x] Step 3: Inspect the final diff

Confirm no source enum, source field, or EXTRA review branch remains. Confirm .env, generated Prisma artifacts, and unrelated UI files are not staged.

- [ ] Step 4: Commit the phase

```
bash
git add prisma shared server client docs/development docs/superpowers/specs docs/superpowers/plans
git commit -m "feat: unify planned workouts and add profile context"
```

- [ ] Step 5: Push main

```
bash
git push origin main
```

If the remote has moved, stop and reconcile the history without force-pushing.
