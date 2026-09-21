# Weekly Cycle and Calendar Redesign

## Goal

Replace the four-week training cycle with a seven-day cycle. The server lazily processes an overdue active cycle on the user's next authenticated request, saves a weekly review, generates the next week's draft plan, and waits for explicit user confirmation before activation. The client displays one seven-day window at a time using FullCalendar.

## Product rules

- A cycle spans exactly seven inclusive calendar dates: `endDate = startDate + 6 days`.
- A cycle number identifies a week, not a four-week batch.
- Review analysis uses the current week's completed training as the primary input and the immediately previous week's volume only for a shallow comparison.
- Manual AI review, user-written review summaries, four-cycle batch reviews, and their persistence/API/UI are removed.
- Remaining `PLANNED` workouts are cancelled when an overdue cycle is processed.
- If the week has zero completed workouts, the snapshot is `RESET_REQUIRED` and no next-week plan is generated.
- If review AI fails, the active cycle remains unchanged and the next request may retry.
- If next-plan generation fails after review persistence, the closed cycle and review remain; next-plan generation is retryable.
- The next draft starts at `max(previousEnd + 1 day, user's current local date)` and spans seven dates.
- A draft is activated only by explicit user confirmation.
- Existing development data from old 28-day cycles is not silently converted. The migration must fail clearly if incompatible cycles exist; test/development environments may be reset separately.

## Architecture

The existing `CycleReviewSnapshot` stores the weekly review, shallow previous-week context, and a JSON next-week draft. No replacement batch table is introduced. `CycleReviewService.processDueWeeklyCycle` is the single lazy-trigger entry point and is called by current-cycle/calendar-facing server routes. Calendar data is queried by a seven-day range and rendered by FullCalendar's React adapter with custom event content and navigation.

## Acceptance criteria

- No active business code depends on four-week lengths, batch reviews, or user-entered review summaries.
- Domain, server, client, E2E type checks and tests cover weekly dates, automatic processing/retry behavior, draft confirmation, and seven-day navigation.
- FullCalendar is installed as a client dependency and only owns presentation/navigation; cycle locks and mutations remain server-owned.
