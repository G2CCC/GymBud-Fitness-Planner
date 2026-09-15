# Cycle Volume Review and Fixed Four-Cycle Planning

**Status:** Approved for implementation on 2026-09-15

## Goal

Make cycle review depend on actual training volume rather than workout source
or planned-versus-extra classifications. Keep one optional manual review per
cycle, provide a shallow comparison with the immediately previous reviewed
cycle, and only offer the grouped review and next-plan flow after fixed
four-cycle batches.

## Decisions

1. Every `ScheduledWorkout` remains a plan. The review domain does not contain
   AI/manual/original/extra source fields.
2. A cycle review is limited to one persisted AI result per cycle. Repeated
   reads return the saved result and do not call the model again.
3. The AI review input is an actual-volume contract. It contains completed
   workout counts and activity-specific actual metrics; it does not contain
   source labels or planned workout details.
4. A single-cycle review may include the immediately previous cycle only when
   that cycle already has a completed review snapshot. The comparison is a
   shallow metric delta, not a second full review.
5. Four-cycle batches are fixed and non-overlapping: 1–4, 5–8, 9–12, and so
   on. The batch contains exactly four cycles and never accumulates earlier
   history.
6. A grouped review is eligible after cycle numbers divisible by four. The
   server creates an eligibility record but does not invoke AI in the
   background. The next login or an explicit user action can request it.
7. A next-cycle AI draft can only be requested from a completed grouped review.
   The draft remains `DRAFT` until the user confirms it.
8. User-written review text is transient request context. Only the processed
   AI summary, conclusions, and objective volume data are persisted.

## Volume contract

The shared domain exposes a `CycleTrainingVolume` value:

- completed workout count;
- completed strength set and repetition counts;
- weighted strength volume separated by `KG` and `LB` because units cannot be
  safely mixed;
- unweighted strength repetitions for bodyweight sets;
- actual cardio duration and distance;
- actual sport duration.

Missing actual values remain missing and are not replaced by planned targets.

## Persistence

`TrainingCycle.cycleNumber` is nullable only for legacy/draft rows. The server
assigns the next per-user number when a draft becomes active, and the migration
backfills existing rows chronologically. `CycleReviewSnapshot` stores the
single-cycle result and optional previous-cycle comparison. A separate
`CycleBatchReview` stores the exact four-cycle window, its processed result,
and its user-confirmable next-cycle draft state.

## Out of scope

- onboarding choice between a user-entered plan and AI generation;
- a new manual-plan editor;
- rolling review windows;
- background jobs that close inactive cycles or call AI without user activity;
- storing raw review notes or arbitrary historical prompt text.

