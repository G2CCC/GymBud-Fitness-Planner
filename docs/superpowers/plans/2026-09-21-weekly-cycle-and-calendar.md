# Weekly Cycle and Calendar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace four-week cycles and batch reviews with weekly automatic review/draft generation and a FullCalendar seven-day client.

**Architecture:** Keep `TrainingCycle` and `CycleReviewSnapshot`, remove batch-review persistence, and make the review service's lazy weekly processor the only automatic transition entry point. Expose range-based calendar data while preserving existing workout mutation endpoints.

**Tech Stack:** TypeScript, Prisma/PostgreSQL, Express, React, Vitest, Playwright, FullCalendar React/day-grid.

**Spec:** `docs/superpowers/specs/2026-09-21-weekly-cycle-design.md`

## Global Constraints

- A cycle is exactly seven inclusive calendar dates.
- Review compares the current week primarily and the immediately previous week shallowly.
- No user-written AI review summary, four-cycle batch table, or unconfirmed calendar insertion.
- Old incompatible 28-day data must not be silently converted.
- FullCalendar owns display/navigation only; server rules remain authoritative.

## Review Focus

- Repeated lazy-trigger requests must not close or draft the same cycle twice; test idempotency.
- AI failure must leave the active cycle and planned workouts unchanged; test retryability.
- A delayed user must receive a draft starting today rather than dates already in the past; test date selection.
- A zero-completion week must produce `RESET_REQUIRED` without a next draft; test this branch.
- Calendar navigation beyond the available cycle must not expose editable future workouts; test range boundaries and read-only history.

### Task 1: Weekly shared domain and contract

**Files:** `shared/src/domain/cycles/*`, `shared/src/domain/reviews/*`, `shared/src/api/contracts.ts`, related shared tests.

- [ ] Add failing tests for seven-day date derivation, previous-week comparison, and removal of batch status contracts.
- [ ] Run the focused shared tests and observe the expected failures.
- [ ] Implement weekly date helpers and simplify review status/result types.
- [ ] Remove batch exports and four-cycle aggregation code; update consumers enough to compile.
- [ ] Run all shared tests and typecheck.

### Task 2: Prisma schema and migration

**Files:** `prisma/schema.prisma`, new migration, Prisma-related tests/seed.

- [ ] Add schema tests/validation for removal of `CycleBatchReview` and its enum/relation.
- [ ] Update schema and create a forward-only migration that drops batch-review persistence and rejects incompatible 28-day cycles before destructive changes.
- [ ] Generate Prisma client and validate the schema.

### Task 3: Weekly cycle lifecycle and review service

**Files:** `server/src/cycles/service.ts`, `server/src/reviews/service.ts`, AI review schemas/prompts, server review tests.

- [ ] Add failing integration/unit tests for `processDueWeeklyCycle`, retry behavior, zero-completion reset, cancellation of remaining planned workouts, and next-draft idempotency.
- [ ] Implement `generateWeeklyReview`, `generateNextWeeklyDraft`, `ensureNextWeeklyDraft`, and the lazy processor.
- [ ] Make all cycle creation/activation and plan date validation seven-day aware.
- [ ] Remove manual and batch review methods, summary arguments, and four-cycle feature metadata.
- [ ] Run focused server review/AI tests, then the server suite.

### Task 4: Server routes and weekly calendar API

**Files:** cycle routes, review routes, new/updated calendar route, shared/client API clients and contracts.

- [ ] Add failing route tests for lazy processing and `GET /api/calendar?weekStart=...` seven-day payload.
- [ ] Implement the route contract, remove obsolete batch/manual review routes, and preserve explicit next-draft confirmation.
- [ ] Run route tests and server/client typechecks.

### Task 5: FullCalendar client and review flow

**Files:** `client/package.json`, lockfile, calendar/review pages/components/tests.

- [ ] Add failing UI tests for seven-day rendering, previous/next/today navigation, read-only history, and removal of summary/batch controls.
- [ ] Install FullCalendar React/day-grid dependencies.
- [ ] Replace the 28-card calendar with a controlled seven-day FullCalendar view and custom workout events.
- [ ] Update Review page to show automatic weekly review and edit/confirm the next draft.
- [ ] Run client UI tests and build/typecheck.

### Task 6: E2E, docs, scan, and final verification

**Files:** E2E fixtures/specs, active development docs, README.

- [ ] Update first-cycle and backfill fixtures to seven-day semantics.
- [ ] Add/adjust E2E coverage for weekly confirmation and calendar navigation.
- [ ] Update active docs and remove stale active references.
- [ ] Run full tests, E2E typecheck, all workspace typechecks, Prisma validation, diff checks, and a global forbidden-term scan.
- [ ] Perform final review and commit the completed change on `main`.
