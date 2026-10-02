# Nutrition implementation verification

Feature branch: `feat/nutrition-tracking`. Base: `f9c77517c21a344b1029ec6b8c8cd48d7d382143`.

## Verified after independent review and fixes

- Full Vitest suite: 272 passed across 75 files, no database skips. Covers fixed targets, snapshots, day revisions, request deduplication, date keys, exercise estimates and frozen review inputs.
- Application and E2E TypeScript checks passed.
- Vite production client build passed. Existing large-bundle advisory remains; no bundle optimization was required for this feature.
- Prisma schema validation passed; the full 12-migration chain was applied repeatedly to new isolated databases.
- Both requested Playwright flows passed: nutrition (meals without an active cycle, g/ea, completion/editing, strength/cardio, backfill, immutable previous-day data, frozen cycle review and mobile keyboard flow) and backfill/close prerequisites.
- Real SR Legacy import: 7,793 source records, 135 reviewed selections, 7,658 excluded by explicit selection. First import created135; second created0/updated135, stable IDs.
- Mobile diary and dialog screenshots were inspected during E2E. Food-search focus was corrected from observed browser behavior.

## Environment boundary

Database functional/integration runs used the official `@prisma/dev` PGlite PostgreSQL-wire server in an external test runtime, with a single connection. Native PostgreSQL could not be installed under this workspace's UID restrictions. **Native PostgreSQL parallel-transaction behavior remains unverified**; repeat concurrency tests against real PostgreSQL before deployment. Production dependencies/configuration were not replaced with PGlite.

The normal Playwright browser CDN returned a truncated archive. Browser tests used compatible Chromium153 from an external `@sparticuz/chromium` package with system fontconfig, without changing application dependencies or disabling web security. Normal development should use `npx playwright install chromium`.

## Implementation decisions

- Ruling: Fresh conversation-local clone on feature branch is already isolated; no nested worktree — avoids duplicate checkout — no effect on user checkout.
- Ruling: Native PostgreSQL package install blocked by environment UID restrictions; prepare local PGlite PostgreSQL-wire test server without changing production dependencies. Native PostgreSQL concurrency remains a separate gate if unavailable — risk is concurrency semantics not covered by a single-session database.
- Task1 Ruling: Full DB run exposed pre-existing stale fixtures: January cycle with December AI date; obsolete occupied-date wording; calendar expected30th but inserted15th; log lacked required weight/unit and expected oldexerciseid; illegalexercise fixture nowlegal; authfixture lackedauthUserId; aiRecommendation delegate casing. Correct fixtures/assertions to current contracts, scope legacy lookups to fixture user. No unrelated production behavior change; risk is accidental weakening, guarded by retaining original behavioral assertions.
- Task2 Ruling: Seed catalog-schema fixture independently — full suite exposed ordering dependency — no production impact, extra fixture setup only.
- Task3 Ruling: Current strength catalog has66 curated entries, not800; explicit mapping covers all66 with Plank/Pallof unsupported; Air Bike unsupported because source described arms-only — avoid false precision — these activities show missing coverage.
- Task5 Ruling: Enable135 reviewed basic foods from7793 source records, with approved ea portions only for eggs/apple/banana — bound first release review scope — catalog is intentionally smaller and expandable through the selection manifest.
- Task6 Ruling: Normalize quantities to4 decimal places with minimum0.0001 — align fingerprint and persisted Decimal precision — finer precision cannot be recorded.
- Task11 Ruling: Atomically close eligible cycle and freeze review input before the external AI call; a failed AI call leaves a closed pending review that can be retried from the same report URL — prevents training edits from changing frozen inputs — retry must remain available and frozen training cannot be reopened after provider failure.
- Task12 Ruling: Repair stale E2E harness: /today→/calendar or /onboarding, API paths retain /api, backfill supplies actual log, unresolved planned work is explicitly deleted instead of expecting removed CANCELLED state — align tests to current routes/state contracts — old incorrect behavior is intentionally no longer asserted.
- Task12 Ruling: Browser CDN returned a truncated archive; use compatible Chromium from an external test-only npm runtime with system fontconfig — obtain a real browser run without production dependencies or disabled web security — default Playwright browser download remains recommended outside this environment.

## Independent review

An independent whole-branch review found no Critical issues, three Important issues and one initially Minor issue. The last was regraded Important because an identical successful submission could surface as a failed save, breaking the approved idempotency behavior. All four entered one consolidated fix pass, with reproductions observed failing before implementation and passing after:

- Crossing the date line after a timezone-only profile save could rewrite a past pinned day's target. Target effective dates now respect previous timezone context and persisted day boundaries.
- Training writes could commit after review inputs were frozen. All workout mutations, plan confirmations, weight decisions and cycle close/review now serialize on the cycle row before reading mutable inputs. A parent-row write ensures a competing RepeatableRead review retries with a fresh snapshot.
- Concurrent profile saves could leave the target inconsistent with saved body data. Profile saves lock the stable owner row before reading the prior profile, including first creation.
- Identical concurrent food adds could fail at the revision claim. Adds retry that conflict once after rollback to return the canonical request result; different or deleted tokens still fail.

The profile/training/request interleaving regressions are controlled simulations, not evidence of native PostgreSQL locking behavior. The timezone regression uses the database. The full suite, both requested E2E flows, application typecheck and production build passed after the fixes.

Deferred minor observed during E2E: overlapping background cycle-initialization calls can log an existing next-draft 409 conflict; both user flows still passed. This is outside the nutrition write/freeze fixes. The pre-existing production bundle-size advisory also remains.

No merge, remote push or deployment has been performed.
