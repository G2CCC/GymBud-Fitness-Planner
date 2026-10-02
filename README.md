# GymBud Fitness Planner

GymBud is a web-first fitness planner with weekly training cycles,
equipment-aware exercise metadata, per-set strength logs, actual
training-volume reviews, and an explicit user confirmation step before an
AI-generated plan is added to the calendar.

## Architecture

The repository is an npm-workspaces monorepo:

- `client`: React, Vite, React Router, and Tailwind UI for the responsive web
  app.
- `server`: Node.js, Express, Prisma, and the AI boundary.
- `shared`: TypeScript domain enums, validation, and cycle/review rules shared
  by clients and the server.
- `prisma`: PostgreSQL schema, migrations, and seed data.

The server is the only layer that talks to PostgreSQL/Supabase. The client
never receives database credentials.

## Prerequisites

- Node.js 22 or later
- npm 10 or later
- A Supabase PostgreSQL project for database-backed development

Copy the environment template and fill in the Supabase database and Auth
settings:

```bash
cp .env.example .env
```

Use the Supabase Session Pooler URL for `DATABASE_URL` and the direct database
URL for `DIRECT_URL`. Keep both URLs server-side and never commit `.env`.
See [`docs/development/supabase.md`](docs/development/supabase.md) for the
connection-role rationale.

## Install and database setup

```bash
npm install
npm run db:generate
npx prisma migrate deploy --schema prisma/schema.prisma
npm run db:seed
```

The seed is idempotent and loads the curated Strength catalog plus the
Cardio/Sport ActivityOption catalog, then migrates references from the six old
ownerless `system-*` exercises. To rebuild or upload the Strength metadata and
images:

```bash
npm run catalog:build-manifest
npm run catalog:sync-images
```

`catalog:sync-images` requires the server-only `SUPABASE_SERVICE_ROLE_KEY`
and uploads to `EXERCISE_IMAGE_BUCKET` (default `exercise-images`). The
service-role key must never be placed in client/Vite environment variables.

`migrate deploy` applies migrations already committed to the repository. Use
`npm run db:migrate -- --name <name>` only when developing a new schema change
locally and committing the generated migration afterwards.

The profile/set-log migration intentionally stops if legacy rows still contain
NULL demographic or actual-weight values; it does not invent historical data.
Venue fields are removed as part of that migration.

## Run the web app locally

Start the API and web client in separate terminals:

```bash
npm run dev --workspace @fitness/server
npm run dev --workspace @fitness/client -- --host localhost
```

Open `http://localhost:5173`. Unauthenticated visitors see the public landing
page. Create an account or sign in with the Supabase email/password provider to
enter the protected Today dashboard.

For authenticated local development, set these server variables in `.env`:

```text
AUTH_PROVIDER=supabase
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=[PUBLIC-ANON-KEY]
CORS_ORIGINS=http://localhost:5173
```

Set the matching public values for the Vite client when they are not supplied
through the shell:

```text
VITE_API_URL=http://localhost:3000/api
VITE_SUPABASE_URL=https://[PROJECT-REF].supabase.co
VITE_SUPABASE_ANON_KEY=[PUBLIC-ANON-KEY]
```

The client only receives the public/anon key. Database URLs and service-role
keys stay server-side. New accounts may need to confirm their email before
they can sign in, depending on the Supabase Auth email-confirmation setting.

By default, AI calls use the configured OpenAI-compatible provider. For local
UI work and automated tests, the server supports a deterministic provider:

```bash
AI_PROVIDER=fake npm run dev --workspace @fitness/server
```

The fake provider is intentionally selected only by an explicit environment
value. It must never be used as a production AI implementation.

## Tests and release checks

Run the unit and integration test suite:

```bash
npm test -- --testTimeout=30000
```

Run the browser E2E suite:

```bash
npx playwright install chromium
npm run test:e2e
```

The browser install is required once per development machine or CI image.
Database-backed E2E scenarios are skipped when `DATABASE_URL` is absent. The
Playwright process uses `AUTH_PROVIDER=fake`, `E2E_AUTH_ENABLED=true`, and the
isolated `E2E_USER_ID` only for deterministic tests; it never enables fake Auth
in production and never makes a paid AI request. Playwright starts both the
API and Vite client automatically.

The normal Prisma seed creates the curated Strength and ActivityOption catalog
records, then migrates the six legacy system-exercise references. Test setup
explicitly calls `seedTestUser()` for its isolated identity.

Additional checks used before a release:

```bash
npm run typecheck --workspace @fitness/shared
npm run typecheck --workspace @fitness/server
npm run typecheck --workspace @fitness/client
npm run build --workspace @fitness/client
npx prisma validate --schema prisma/schema.prisma
npx playwright test --list
```

## Product rules implemented in the MVP

- Cycles are `DRAFT`, `ACTIVE`, or `CLOSED`; there is no pause state.
- A cycle covers seven inclusive days, and its final day is the end date.
- A cycle remains active after its end date until the user responds to the
  review prompt. Every planned workout must first be completed or deleted;
  review then closes the cycle and freezes its inputs.
- Each completed cycle receives one automatic actual-volume review. The
  immediately previous week is used only for shallow comparison.
- A next-cycle draft is never inserted into the calendar until the user
  explicitly confirms it.
- Profile sex, age, height, and body weight are required planning context.
- Actual strength-set weight and unit are required; bodyweight or no external
  load is recorded as `0 KG`.
- Backfilled completion always requires an actual past date and time.

More detailed contracts live in [`docs/development`](docs/development) and the
mobile boundary is described in
[`docs/mobile-readiness.md`](docs/mobile-readiness.md).

## Nutrition and exercise energy

Nutrition is available at `/nutrition` after saving a profile, even without an
active training cycle. Choose Male/Female and one goal: fat loss, muscle gain,
or maintenance. The browser supplies the recording timezone on profile save.
A day keeps the timezone it had when first recorded.

The fixed **net** target uses `nutrition-v1`: Mifflin resting estimate
`10 × kg + 6.25 × cm − 5 × age + (5 male / −161 female)`, multiplied by `1.2`
and the goal factor (`0.90` fat loss, `1.05` muscle gain, `1.00` maintenance),
rounded to kcal. Protein is `1.8 g/kg` for fat loss/gain or `1.6 g/kg` for
maintenance; fat supplies 30% of target calories; carbohydrate supplies the
remainder. Macros round to 0.1 g. Invalid negative/nonfinite results are rejected.
This release uses one formula and the existing 13–100 profile age validation.
Targets are estimates, not individualized medical prescriptions.

`Net intake = logged food kcal − completed workout extra-energy estimates`.
Net intake is derived, never a mutable balance, and can be negative. Macro targets
do not change with exercise. Profile changes replace today's target or create a
future-effective version without changing past target dates.

Food logs support four meals and grams, plus verified `ea` portions. They retain
food names, per-100 g nutrients and portion weights as snapshots. Editing quantity
uses that snapshot even if the catalog item was subsequently deactivated. A day
counts toward full-day report averages only after explicit completion; food edits
reopen it. Empty-day completion requires an extra confirmation. Entry writes use
a day revision and UUID request token to prevent stale writes and duplicate adds.

### Load the food catalog

Use the PostgreSQL URLs configured for your intended **development** database:
`DATABASE_URL` and `DIRECT_URL`. Generate Prisma and apply migrations before import.
Download and extract the official archive linked in
[`data/foods/source-manifest.json`](data/foods/source-manifest.json), then run:

```bash
npm run db:generate
npx prisma migrate deploy --schema prisma/schema.prisma
npm run foods:import -- --input /path/to/FoodData_Central_sr_legacy_food_json_2018-04.json --release 2018-04
```

The importer checks the extracted JSON SHA-256, release, selection IDs and names
before writing. The initial selection is **135 basic foods**, with verified each
sizes for eggs, apples and bananas. Rerunning preserves source-key IDs. Removed
items are deactivated instead of deleted. The source archive is not in git.
See [`docs/data/food-catalog.md`](docs/data/food-catalog.md) for source licensing,
nutrient IDs, sample values and portion decisions. No separate food API key is
needed. The GitHub `alyssaq/usda-sqlite` project is a structure reference; this
release imports USDA's official SR Legacy 2018-04 data, not its older SR28 copy.

### Workout estimates and cycle reports

A completed/backfilled workout requires valid actual logs. Strength uses actual
nonzero-repetition sets, a 3.5 MET default, 4 seconds per rep, and planned rest
(or 60 seconds), with no new actual-duration input. Per-action unrounded extra
energy is summed and rounded once for the workout. Cardio/sport use actual
minutes and reviewed activity defaults. Estimates subtract the resting 1 MET
component to avoid counting it twice. Saved body-weight inputs are not rewritten
when the profile changes. `Plank`, `Pallof Press`, unknown custom exercises and
Air Bike currently have no supported estimate. Mixed sessions show partial
coverage. Source assumptions are in
[`docs/data/exercise-energy.md`](docs/data/exercise-energy.md).

Cycle reports use the cycle's actual inclusive date window. Food means use
confirmed days; macro gaps also require targets; net comparisons additionally
require complete exercise coverage. At least 3 complete food days are needed for
an intake trend, and 3 comparable net days for a net-target trend. Reports compare
means with sample counts. They never change nutrition targets.

An eligible review closes the cycle and freezes its training/nutrition input in
one consistent database transaction **before** calling AI. A provider failure
leaves a closed pending review; use **Retry review** on `/review/:cycleId` to reuse
the same input. The nutrition diary remains editable independently. Later diary
changes do not rewrite a saved report.

### Verification and fresh development databases

The nutrition migration intentionally replaces the old free-text goal/gender
fields. This project has no existing user-data migration requirement. For a
throwaway local database only, after verifying both URLs point to that disposable
database, `npx prisma migrate reset --schema prisma/schema.prisma` rebuilds it and
erases its contents. Never put reset in a production deployment step.

```bash
npm run typecheck
npm run typecheck:e2e
npm test
npm run build --workspace @fitness/client
npx prisma validate --schema prisma/schema.prisma
npx playwright test tests/e2e/nutrition.spec.ts tests/e2e/backfill-and-close.spec.ts
```

E2E setup deletes only its isolated test user's data and seeds small food
fixtures. Always point `DATABASE_URL`/`DIRECT_URL` at a disposable test database.
Install Playwright Chromium with `npx playwright install chromium`; an existing
compatible executable can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
All application auth/AI environment requirements above still apply outside E2E.
