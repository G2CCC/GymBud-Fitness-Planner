# GymBud Fitness Planner

GymBud is a web-first fitness planner with four-week training cycles,
location-aware exercises, per-set strength logs, actual training-volume
reviews, and an explicit user confirmation step before an AI-generated plan is
added to the calendar.

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

Copy the environment template and fill in the two Supabase connection strings:

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

`migrate deploy` applies migrations already committed to the repository. Use
`npm run db:migrate -- --name <name>` only when developing a new schema change
locally and committing the generated migration afterwards.

## Run the web app locally

Start the API and web client in separate terminals:

```bash
npm run dev --workspace @fitness/server
npm run dev --workspace @fitness/client -- --host localhost
```

Open `http://localhost:5173`. The current MVP uses a seeded demo-user adapter;
the server resolves that user from `DEMO_USER_ID` while authentication is not
yet integrated.

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
Database-backed E2E scenarios are skipped when `DATABASE_URL` is absent. With
Supabase configured, the Playwright setup uses the isolated user id
`e2e-demo-user`, resets only that user's cycles, and starts the API with
`AI_PROVIDER=fake`; no paid AI request is made. Playwright starts both the API
and Vite client automatically.

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
- A cycle covers 28 inclusive days, and the fourth week's final day is its
  end date.
- A cycle remains active after its end date until the user responds to the
  review prompt. Review closes the old cycle and auto-cancels unresolved
  planned workouts in that same cycle.
- Each cycle can receive one manual actual-volume review. Fixed four-cycle
  reviews cover `1–4`, `5–8`, `9–12`, and later batches without accumulating
  older volume.
- An optional review note is sent to AI for context, but raw user text is not
  persisted.
- A next-cycle draft is never inserted into the calendar until the user
  explicitly confirms it.
- Workout locations are `GYM` and `HOME`. The server validates exercise
  legality; equipment-only exercises cannot be logged at home.
- Backfilled completion always requires an actual past date and time.

More detailed contracts live in [`docs/development`](docs/development) and the
mobile boundary is described in
[`docs/mobile-readiness.md`](docs/mobile-readiness.md).
