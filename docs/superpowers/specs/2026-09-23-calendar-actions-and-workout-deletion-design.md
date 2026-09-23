# Calendar Actions and Workout Deletion Design

## Status

Approved product direction for implementation after the user confirmed:

- single-day AI generation is Strength-only;
- a date with an existing workout must be cleared before generation;
- only today through the active cycle end date can be selected;
- Add session and Generate plan use compact, left-aligned in-page panels;
- Review cycle is always visible and disabled until the review rules allow it;
- existing `CANCELLED` records are deleted;
- the application no longer exposes a `CANCELLED` workout state;
- users manually delete unfinished planned sessions before reviewing a cycle.

## Product Rules

### Workout lifecycle

The only persisted workout statuses are:

- `PLANNED`: a future or current workout that has not been completed;
- `COMPLETED`: a workout with a saved completion log.

Users may permanently delete only `PLANNED` workouts. Completed workouts are historical facts and cannot be deleted through the application.

The previous `CANCELLED` status is removed from the database enum, shared types, state machine, API, UI, progress metrics, review summaries, AI context, styles, and tests. Existing rows with `CANCELLED` are physically deleted during the migration. This is intentionally destructive and must be performed before the enum value is removed.

### Review lifecycle

Review analysis uses completed workouts only. Planned workouts do not contribute to training volume or review conclusions, but a planned workout still blocks cycle review until the user either completes or deletes it.

The Calendar always renders the Review cycle action. It is enabled when the cycle is reviewable and disabled otherwise. The API provides the user-timezone-aware earliest review date and remaining calendar days so the client does not duplicate date logic.

The application does not automatically delete unresolved planned workouts at cycle close. The user must delete them manually before Review becomes available.

### Manual session panel

Add session is a persistent action that opens a compact, left-aligned panel with the existing manual workout form. The panel is not full width and does not cover the calendar. It can be closed without submitting.

### Single-day AI plan

Generate plan is a persistent Calendar action. It opens a compact panel containing:

- a scheduled date restricted to today through the active cycle end date;
- one or more Strength focus areas;
- a generate action.

The selected date must have no existing workout. A planned workout can be deleted first; a completed workout cannot be deleted and prevents generation for that date.

AI generation returns a single-workout draft. It never writes calendar records by itself. The user reviews or edits the draft and explicitly confirms it before the server creates the workout and planned exercises in one transaction.

The generated workout uses the existing `ScheduledWorkout`, `PlannedExercise`, and `PlannedSet` models. No source label distinguishes AI-generated and manual workouts.

## Technical Boundaries

- No new persistence model is required for a single-day draft.
- The existing weekly/draft-cycle generation flow remains separate from active-cycle single-day generation.
- The single-day flow must validate cycle ownership, active status, date range, empty target date, legal exercises, and Strength-only content on the server.
- Review date calculations remain server-authoritative and use the cycle timezone.
- Deleting a planned workout cascades its planned exercises and sets through the existing relations.

## User-visible Outcomes

- Calendar actions are always discoverable without showing three large forms at once.
- Users can remove unwanted future sessions without creating cancellation history.
- Progress and review language no longer reports cancellation counts.
- Review is based solely on completed training.
- Users can generate an extra Strength plan for an empty future day without creating a new cycle.
