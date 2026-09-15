# Cycle Volume Review Implementation Plan

## Task 1: Shared volume and batch rules

- [x] Add the actual-only `CycleTrainingVolume` contract and aggregation function.
- [x] Add fixed batch helpers for `1–4`, `5–8`, `9–12`, and later groups.
- [x] Write domain tests for weighted/unweighted strength volume, cardio/sport
  metrics, missing actual values, previous-cycle comparison, and non-overlapping
  batch windows.

## Task 2: Database lifecycle state

- [x] Add a per-user cycle number and the `CycleBatchReview` model.
- [x] Add optional previous-cycle volume/review metadata to the single-cycle
  snapshot.
- [x] Create a non-destructive migration that backfills existing cycle numbers.

## Task 3: Single-cycle review service

- [x] Build the actual volume from persisted workout logs.
- [x] Keep the current close ordering and one-review idempotency.
- [x] Pass current volume and optional previous-cycle comparison to AI.
- [x] Do not create a next-cycle plan after an ordinary cycle review.

## Task 4: Fixed four-cycle review and draft

- [x] Create an eligibility record only after cycle 4, 8, 12, etc.
- [x] Add explicit batch-review and batch-next-draft routes.
- [x] Reuse plan validation and user confirmation so unconfirmed drafts never add
  calendar workouts.

## Task 5: Client and verification

- [x] Show current-cycle volume and optional previous-cycle comparison.
- [x] Show the four-cycle prompt only for an eligible fixed batch.
- [x] Add focused integration/UI tests, then run the full test suite, typechecks,
  Prisma validation, and production build.
