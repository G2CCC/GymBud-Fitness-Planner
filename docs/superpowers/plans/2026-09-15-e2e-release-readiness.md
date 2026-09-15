# GymBud MVP E2E and Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the current GymBud MVP through real HTTP/browser flows and document the web-to-iOS boundary without reintroducing removed workout-source concepts.

**Architecture:** Playwright will run against the existing Express API and Vite client. A deterministic fake AI provider will be enabled only when `AI_PROVIDER=fake`, so E2E tests never call a paid external model. The E2E user and database fixtures remain isolated from the seeded demo user through `DEMO_USER_ID`.

**Tech Stack:** Playwright Test, React/Vite, Express, Prisma/PostgreSQL/Supabase, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-09-fitness-planner-mvp-design.md` plus the approved cycle-volume review design in `docs/superpowers/specs/2026-09-15-cycle-volume-review-design.md`.

## Global Constraints

- Planned workouts have no source, `ORIGINAL`, or `EXTRA` classification.
- Activity types remain `STRENGTH`, `CARDIO`, and `SPORT`.
- Workout statuses remain `PLANNED`, `COMPLETED`, and `CANCELLED`.
- Backfill completion must include an actual past date and time.
- Closed cycles and their workouts are read-only after closure.
- E2E tests must use a deterministic fake AI response and must not require an external AI key.
- Database-backed E2E tests are skipped when `DATABASE_URL` is absent; configuration, typecheck, and test collection still must pass.
- No `.env`, generated Prisma client, or temporary tooling directory may be committed.

---

### Task 1: Add a deterministic E2E runtime boundary

**Files:**
- Modify: `server/src/config/env.ts`
- Modify: `server/src/ai/client.ts`
- Modify: `server/src/ai/fake-client.ts`
- Modify: `server/src/index.ts`
- Modify: `.env.example`
- Modify: `package.json`
- Create: `server/tests/ai/fake-client.test.ts`

**Interfaces:**
- `env.aiProvider` is `openai` by default and accepts `fake` for local automated tests.
- `createConfiguredAiClient()` returns a deterministic `FakeAiClient` only for `AI_PROVIDER=fake`.
- `GET /health` returns `{ data: { status: "ok" } }` without requiring a database query.

- [x] Write a failing test proving fake mode returns a schema-valid plan and review response.
- [x] Run the focused test and verify it fails because provider selection and deterministic responses do not exist.
- [x] Implement provider selection, deterministic plan/review responses, and the health route.
- [x] Run the focused test and verify it passes.

### Task 2: Add Playwright end-to-end flows

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/support/database.ts`
- Create: `tests/e2e/first-cycle.spec.ts`
- Create: `tests/e2e/backfill-and-close.spec.ts`
- Create: `tests/e2e/location-validation.spec.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Playwright starts the API with `AI_PROVIDER=fake`, `DEMO_USER_ID=e2e-demo-user`, and the Vite client.
- Each test creates only its own cycle/workouts and cleans them up through the E2E database helper.

- [x] Write the first-cycle flow: profile → cycle draft → fake AI plan → explicit confirmation → browser calendar → actual strength completion → `COMPLETED`.
- [x] Write the backfill/close flow: missing backfill timestamp rejected → past timestamp accepted → unresolved planned workout auto-cancelled on review → closed-cycle mutation rejected.
- [x] Write the location flow: HOME exercise query excludes equipment-only exercises, equipment logging at HOME is rejected, and bodyweight logging remains valid.
- [x] Run Playwright collection and verify database-gated specs are skipped without a database rather than failing during collection.
- [ ] Run the E2E suite with Supabase credentials when available and inspect the browser-visible assertions.

### Task 3: Document release and mobile readiness

**Files:**
- Create: `README.md`
- Create: `docs/mobile-readiness.md`
- Modify: `docs/development/cycles.md`
- Modify: `docs/superpowers/plans/2026-09-09-fitness-planner-mvp.md`

- [x] Document local setup, Supabase migration deployment, seed, fake-AI mode, web startup, and E2E commands.
- [x] Document that future iOS screens may reuse `@fitness/shared`, API contracts, validation, and fetch boundaries, while React DOM pages and `client/src/router.tsx` remain web-only.
- [x] Replace stale Task 10 references to workout source labels and unsupported replacement persistence.

### Task 4: Run release verification and commit

- [x] Run the full Vitest suite with the configured database caveat.
- [x] Run shared, server, client, and E2E typechecks.
- [x] Run the client production build and Prisma validation.
- [x] Run Playwright collection/E2E command.
- [x] Run `git diff --check` and inspect staged paths.
- [x] Commit as `test: add MVP E2E and release readiness checks`.
