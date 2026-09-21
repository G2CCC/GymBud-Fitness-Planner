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

GymBud creates a seven-day draft from the user's current local calendar date.
The cycle contains seven inclusive days, so `endDate = startDate + 6 days`. The
last day is therefore the cycle end date.

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
completed workouts, it is still `CLOSED`, but its review conclusion is
`RESET_REQUIRED`; the product must ask the user to reset or confirm their plan
inputs before generating another cycle.

Each active cycle receives a stable per-user `cycleNumber`. Draft rows may be
numberless until activation. This number is used for fixed review batches and
is never reused for another cycle.

## Review timing and inactivity

On the cycle's final local calendar day, completing or cancelling the final-day
workout set makes the review prompt immediately eligible. The system does not
close the cycle automatically.

If the user does not open the app on the final day, the next login after
`endDate` makes the review prompt eligible. The prompt resolves overdue
workouts, accepts the optional user summary, and closes the old cycle. When at
least one workout was completed, the single-cycle review is saved. It does not
create a next-cycle plan.

If the user never logs in, no background job cancels workouts, closes the
cycle, or generates a new plan. The cycle stays `ACTIVE` until the user
responds. This avoids making irreversible decisions from inactivity alone.

During an active cycle, an overdue planned workout stays `PLANNED`. When the
review is submitted, unresolved planned workouts change to `CANCELLED`.
Cancellation has no separate reason field.

Before a next cycle exists, any cancelled workout may be restored to `PLANNED`,
but a new scheduled date is required. Restoration reopens the old cycle so it
can be resolved again. Once a newer cycle exists, the old cycle is read-only
and restoration is rejected. The restored workout remains owned by the old
cycle. Any cached batch review containing that cycle is invalidated and must be
recomputed from the restored workout data.

## Review and next-cycle draft

Submitting the review performs these operations in order:

1. the server checks that the review is due and builds an actual training-volume
   summary from completed workout logs;
2. the AI returns a processed summary and conclusions;
3. only after a valid AI result, unresolved `PLANNED` workouts are
   auto-cancelled and the old cycle is closed;
4. the final post-close training volume and AI result are persisted in the
   review snapshot.

If AI generation fails, the active cycle and its workouts remain unchanged so
the user can retry. If workout facts change while AI is generating, the request
is rejected and must be retried against the newer records.

The user's review note is optional. It is included in the single AI request
when supplied, but the raw note is not written to the database. Only the AI's
processed summary, conclusions, and objective facts are persisted.

The review input is an actual-volume contract. It records completed workout
count, actual strength sets/repetitions and weighted volume, actual cardio
duration/distance, and actual sport duration. Planned details and workout
source labels are not sent to the review model. Missing actual values remain
missing rather than being replaced by planned targets.

Each cycle can have one persisted single-cycle review. If the immediately
previous cycle already has a review, the current prompt may include a shallow
metric comparison; otherwise it is omitted. The user's optional note is sent
only for that request and is never stored.

After cycle 4, 8, 12, and later multiples of four, GymBud exposes a separate
fixed batch review. The batches are exactly `1–4`, `5–8`, `9–12`, and so on;
they never roll forward or include older cycles. No background job calls AI for
an inactive user. On login, the client can show the eligible batch and the user
explicitly starts the grouped review.

Only a completed grouped review can generate the next-cycle AI draft. The draft
is stored as a `DRAFT` cycle with no calendar workout rows. The user must review
and confirm it through the existing plan confirmation flow before it becomes
`ACTIVE`. Batch draft generation uses a durable `READY → GENERATING → READY`
marker so a retry can recover a process that stopped after creating the empty
draft but before saving the AI result.

## Database migration after pulling this change

This change adds cycle numbering, fixed batch review persistence, and previous
cycle review metadata. Run the new migration from
the project directory that already contains your successful initial and
lifecycle migrations:

For a database that already has the committed migrations, use:

```powershell
npm run db:generate
npx prisma migrate deploy --schema prisma/schema.prisma
npm test -- --testTimeout=30000 server/tests/integration/cycle-review.test.ts
```

When creating a new schema change locally, use `npm run db:migrate -- --name
<migration_name>` and commit the generated migration directory.

For a release smoke check, also run `npm run test:e2e`. The browser suite uses
the deterministic AI provider and skips database-backed scenarios when
`DATABASE_URL` is not available.

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
POST /api/cycles/:cycleId/review
GET  /api/cycles/:cycleId/batch-review
POST /api/cycles/:cycleId/batch-review
POST /api/cycles/:cycleId/next-draft
POST /api/cycles/:cycleId/workouts/:workoutId/restore
```

`POST /api/cycles` and `POST /api/cycles/:cycleId/activate` accept an IANA
`timezone` value. The client obtains it from the device; users do not enter it
manually.

All routes resolve the current user on the server. The service repeats the
ownership check inside the Prisma transaction; the client never supplies an
arbitrary `userId`.
