# Training cycle scheduling and lifecycle

## Date and timezone model

GymBud does not ask the user to type a timezone. The web client reads the
computer's IANA timezone (for example, `America/Los_Angeles`) and sends it with
cycle creation/activation. A future mobile client will do the same using the
phone's system timezone.

The server remains authoritative for the current instant. It uses the client
timezone only to derive a local calendar date, then stores that date as UTC
midnight together with the cycle's timezone snapshot. This is a date-only
representation; it is not an event timestamp. Fields such as `completedAt` and
`closedAt` remain real instants.

The cycle timezone is persisted when a draft becomes active. If the user later
travels or changes device settings, the existing cycle does not move between
calendar dates. A new cycle can snapshot the new system timezone.

## Scheduling

GymBud creates a four-week draft from the user's current local calendar date.
The cycle contains 28 inclusive days, so `endDate = startDate + 27 days`. The
fourth week's last day is therefore the cycle end date.

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
```

- `DRAFT`: the AI-generated plan has not been confirmed yet. It may be
  discarded or edited before activation.
- `ACTIVE`: the confirmed cycle accepts normal workout writes. A cycle remains
  `ACTIVE` after its end date if the user has not responded to the review
  prompt.
- `CLOSED`: the user has responded to the end-of-cycle review. Any unresolved
  `PLANNED` workouts are auto-cancelled in this same cycle.

There is intentionally no `PAUSED` status. If a cycle closes with zero
completed workouts, it is still `CLOSED`, but its review snapshot records
`nextCycleEligibility = RESET_REQUIRED`; the product must ask the user to
reset or confirm their plan inputs before generating another cycle.

## Review timing and inactivity

On the cycle's final local calendar day, completing or cancelling the final-day
workout set makes the review prompt immediately eligible. The system does not
close the cycle automatically.

If the user does not open the app on the final day, the next login after
`endDate` makes the review prompt eligible. The prompt resolves overdue
workouts, accepts the optional user summary, closes the old cycle, and—when at
least one workout was completed—creates the next cycle as a user-confirmable
`DRAFT`.

If the user never logs in, no background job cancels workouts, closes the
cycle, or generates a new plan. The cycle stays `ACTIVE` until the user
responds. This avoids making irreversible decisions from inactivity alone.

During an active cycle, an overdue planned workout stays `PLANNED`. When the
review is submitted, unresolved planned workouts change to `CANCELLED` with
`cancellationReason = AUTO_CYCLE_CLOSE`. The reason is persisted so the system
can distinguish automatic review cleanup from a user's explicit cancellation.

Before a next cycle exists, an automatically cancelled workout may be restored
to `PLANNED`, but a new scheduled date is required. Restoration reopens the old
cycle so it can be resolved again. Once a newer cycle exists, the old cycle is
read-only and restoration is rejected. The restored workout remains owned by
the old cycle.

## Database migration after pulling this change

This change removes the `PAUSED` enum value, adds the nullable
`TrainingCycle.timezone` field, and updates the lifecycle snapshot values. Run
the migration from the project directory that already contains your successful
initial migration:

```powershell
npm run db:generate
npm run db:migrate -- --name add_cycle_timezone_and_lifecycle
npm test -- server/tests/integration/cycles.test.ts
```

For existing active cycles created before timezone snapshots were introduced,
backfill a timezone before allowing their review to close. Newly activated
cycles always persist the timezone received from the client.

## HTTP endpoints

The Express API exposes:

```text
POST /api/cycles
POST /api/cycles/:cycleId/activate
GET  /api/cycles/:cycleId/review-status
POST /api/cycles/:cycleId/close
POST /api/cycles/:cycleId/workouts/:workoutId/restore
```

`POST /api/cycles` and `POST /api/cycles/:cycleId/activate` accept an IANA
`timezone` value. The client obtains it from the device; users do not enter it
manually.

All routes resolve the current user on the server. The service repeats the
ownership check inside the Prisma transaction; the client never supplies an
arbitrary `userId`.
