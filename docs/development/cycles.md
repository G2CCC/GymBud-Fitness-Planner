# Training cycle scheduling and lifecycle

## Scheduling

GymBud creates a four-week draft from the current UTC calendar day. The cycle
contains 28 inclusive days, so `endDate = startDate + 27 days`.

The first week's training dates are suggestions derived from the user's weekly
training-day count. They are spread across the seven-day window, while the
actual workout rows are created later when an AI plan draft is reviewed and
confirmed.

For example, three training days starting on 2026-09-09 produce:

```text
2026-09-09, 2026-09-12, 2026-09-15
```

The calculation lives in `shared`, so a future iOS client can display the same
dates without reimplementing the rule.

## Lifecycle

```text
DRAFT -> ACTIVE -> CLOSED
                  \-> PAUSED
```

- `DRAFT`: the AI-generated plan has not been confirmed yet.
- `ACTIVE`: the confirmed cycle accepts normal workout writes.
- `CLOSED`: at least one workout was completed; unresolved `PLANNED` workouts
  are auto-cancelled in this same cycle.
- `PAUSED`: the cycle ended with zero completed workouts; the system does not
  automatically generate another cycle.

During an active cycle, an overdue planned workout stays `PLANNED`. Closing the
cycle changes each unresolved workout to `CANCELLED` with
`cancellationReason = AUTO_CYCLE_CLOSE`. The reason is persisted so the system
can distinguish an automatic closure from a user's explicit cancellation.

Before a next cycle exists, an automatically cancelled workout may be restored
to `PLANNED`, but a new scheduled date is required. Restoration reopens the
old cycle so it can be resolved again. Once a newer cycle exists, the old cycle
is read-only and restoration is rejected.

## Database migration after pulling this change

This feature adds the nullable `ScheduledWorkout.cancellationReason` field and
the `CancellationReason` enum. Run the migration from the project directory
that already contains your successful initial migration:

```powershell
npm run db:generate
npm run db:migrate -- --name add_cycle_lifecycle_fields
npm test -- server/tests/integration/cycles.test.ts
```

The integration test creates temporary users, runs the close transaction
against Supabase, verifies the automatic-cancellation reason, and verifies
restoration before a next cycle exists. The test cleans up its temporary data.

## HTTP endpoints

The Express API exposes:

```text
POST /api/cycles
POST /api/cycles/:cycleId/close
POST /api/cycles/:cycleId/workouts/:workoutId/restore
```

All routes resolve the current user on the server. The service repeats the
ownership check inside the Prisma transaction; the client never supplies an
arbitrary `userId`.
