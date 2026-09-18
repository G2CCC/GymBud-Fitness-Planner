# Workout state transitions and logs

## State transitions

Normal workout writes are allowed only while the workout belongs to an
`ACTIVE` cycle and no newer cycle exists:

```text
PLANNED -> COMPLETED
PLANNED -> CANCELLED
PLANNED -> PLANNED  (reschedule)
```

The shared state machine in
`shared/src/domain/workouts/state-machine.ts` is pure. It does not know about
Prisma or HTTP. The server service loads the workout, verifies ownership and
cycle writability, calls the state machine, and persists the result in a
transaction.

Immediate completion uses the server's current instant. Backfill has a
separate endpoint and requires an explicit `completedAt` date and time. Future
completion timestamps are rejected. The actual timestamp is never replaced by
the scheduled date.

User cancellation and cycle-review cleanup both persist only
`status = CANCELLED`. The system does not record which actor caused the
cancellation.

## Log persistence

`ScheduledWorkout` has at most one `WorkoutLog`. Saving a log uses an upsert:

```text
WorkoutLog (one per workout)
└── ExerciseLog (one per exercise position)
    └── SetLog (one per set number)
```

For strength logs, the service validates that every exercise belongs to the
current user or is a system exercise. `weight` and `weightUnit` are required on
every actual set; bodyweight or no external load is represented as `0 KG`. The
service then upserts exercise positions and set numbers, deleting rows omitted
from the latest complete form submission. Editing a log therefore changes the
same records instead of creating a second log.

Cardio and sport logs use the existing `WorkoutLog.actualDetails` JSON field.
Their Zod schemas are activity-specific and reject unknown fields, including
the unsupported `rpe` field.

## Endpoints

```text
POST  /api/workouts
GET   /api/workouts/:workoutId
POST  /api/workouts/:workoutId/complete
POST  /api/workouts/:workoutId/backfill
POST  /api/workouts/:workoutId/cancel
POST  /api/workouts/:workoutId/reschedule
PUT   /api/workouts/:workoutId/log
```

`POST /api/workouts` creates a new planned workout in the user's active cycle.
It does not modify other calendar workouts. There is no delete endpoint for a
completed log; history is preserved for later cycle analysis.

The current user is resolved server-side. A caller cannot complete, move,
cancel, or log another user's workout by supplying a different user ID.
