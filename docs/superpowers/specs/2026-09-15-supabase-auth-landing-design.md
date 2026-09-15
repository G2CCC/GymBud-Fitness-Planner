# Task 11: Supabase Auth and Public Landing Page

Status: Approved for implementation

Date: 2026-09-15

## Goal

Replace GymBud's single-user demo adapter with authenticated Supabase users,
preserve the existing application data model, and give unauthenticated
visitors a public landing page before they enter the protected fitness app.

## Context and current gap

Task 10 completed the Today dashboard and moved the authenticated product
entry point to /today. The current server still resolves every request from
DEMO_USER_ID, every API route depends on that fixed identity, and CORS is
hard-coded to the local Vite origin. The current Playwright fixtures also use
the demo identity directly.

This means the application is not yet a real multi-user application: two
people using the deployed API would read and mutate the same application user
record. Authentication must be completed before CI, deployment, or public
release work.

## Decisions

### Authentication method

The first production flow uses Supabase Auth with email and password:

- email/password sign-up;
- email/password sign-in;
- session restoration after a browser refresh;
- sign-out;
- a clear message when Supabase requires email confirmation.

Magic links, Google OAuth, phone login, and MFA are outside this task. The
client uses Supabase Auth for session management; the server remains the only
layer that talks to Prisma and PostgreSQL.

### Public and protected routes

| Session state | Path | Result |
|---|---|---|
| Unauthenticated | / | Public LandingPage |
| Unauthenticated | /login, /signup | Public authentication page |
| Unauthenticated | /today, /calendar, /progress, /profile, /onboarding, workout and review routes | Redirect to /login |
| Authenticated | / | Redirect to /today |
| Authenticated | /login, /signup | Redirect to /today |
| Authenticated | protected routes | Render the existing application shell |
| After sign-out | any protected route | Return to / |

The landing page makes no API or database request. It is safe to render before
the user has an application profile or cycle.

### Application-user identity mapping

The existing User.id remains the internal application primary key. Add an
optional unique authUserId field containing the Supabase Auth user id:

~~~prisma
model User {
  id         String  @id @default(cuid())
  authUserId String? @unique
  email      String  @unique
  // existing relations remain unchanged
}
~~~

The field is nullable during migration so existing local and historical rows
are not destroyed. An authenticated request resolves the Supabase identity to
an application User by authUserId; if no row exists, the server creates a new
application user. It may update the email on the same mapped row, but it must
never link an unmapped row by email alone. An email-only link could attach a
new identity to someone else's historical data.

The existing demo row is retained only as a test fixture. Production request
handling has no demo fallback and never accepts a user id from the client.

### Server authentication boundary

Every business route under /api is protected. The existing /health route
remains public for deployment health checks. An Express authentication
middleware:

1. reads Authorization: Bearer <access-token>;
2. rejects a missing or malformed header with 401;
3. asks Supabase Auth to validate the supplied token and obtain the authentic
   user identity;
4. resolves or creates the application User mapping;
5. attaches the application user context to the request.

The route handlers use the request-scoped application user id. Service-level
ownership checks remain unchanged and continue to run inside the existing
Prisma operations.

The server uses an Auth verifier interface so tests can inject deterministic
identities without calling Supabase. AUTH_PROVIDER=fake is accepted only in
Vitest or an explicitly marked E2E process and is rejected in production.

### Client session boundary

The browser creates a Supabase client using only the public Supabase URL and
public/anon key. The request wrapper obtains the current access token and adds
it to API requests. The API server validates the token; the client never
decides that a token is trustworthy.

AuthProvider owns the initial session load and onAuthStateChange subscription.
RequireAuth protects the existing App layout. The auth page owns only
sign-in/sign-up form state and delegates authentication to the provider.

### Environment and CORS

The server accepts:

~~~text
AUTH_PROVIDER=supabase|fake
SUPABASE_URL=<server-side Supabase project URL>
SUPABASE_ANON_KEY=<server-side public/anon key>
CORS_ORIGINS=http://localhost:5173
~~~

The client accepts:

~~~text
VITE_API_URL=http://localhost:3000/api
VITE_SUPABASE_URL=<public Supabase project URL>
VITE_SUPABASE_ANON_KEY=<public/anon key>
~~~

The client key is not a secret. A service-role key and database URLs must
never be included in client variables. CORS_ORIGINS is parsed as a
comma-separated allowlist; it is not replaced by a wildcard.

## Landing page design

LandingPage uses the existing GymBud design tokens and the current
Athletic Calm visual language. It does not add a second design system or
require image hosting in this task.

The page contains:

1. a brand header with GymBud and links to sign in or create an account;
2. a hero statement explaining that GymBud plans, tracks, and reviews
   training;
3. a primary call to action to create an account and a secondary sign-in
   action;
4. a four-step product flow: plan, schedule, train, review;
5. feature cards for AI-assisted planning, calendar scheduling, actual
   workout logging, and cycle progress review;
6. a short product boundary statement that AI suggestions are reviewed by the
   user before they affect the calendar;
7. a final registration call to action.

All interactive controls have visible focus states, accessible names, and a
minimum 44px touch target. The layout must remain usable at 320px width.

## Error behavior

| Condition | Status | Code |
|---|---:|---|
| Missing bearer token | 401 | AUTH_REQUIRED |
| Invalid or expired bearer token | 401 | AUTH_INVALID |
| Authenticated identity conflicts with an unmapped application email | 409 | AUTH_USER_CONFLICT |
| Supabase auth configuration is missing at server startup | startup failure | configuration error |

The client displays human-readable auth errors without exposing token values,
database details, or raw server stack traces.

## Data and security invariants

- No production route reads DEMO_USER_ID.
- No request accepts userId as an ownership authority.
- User A cannot access User B's cycles, workouts, exercises, reviews, or AI
  recommendations.
- Existing cycle, workout, log, and review ownership checks remain active.
- The server never sends database credentials or a service-role key to the
  browser.
- Fake auth cannot start in NODE_ENV=production.
- The landing page does not fetch protected data.
- Training-source categories remain removed; this task does not reintroduce
  them.

## Testing strategy

### Server tests

- configuration parsing accepts Supabase mode and rejects fake auth in
  production;
- the verifier rejects empty or invalid tokens and returns a deterministic
  identity in fake mode;
- middleware returns 401 for missing or invalid authentication;
- first authenticated identity creates one application user;
- repeated requests resolve the same application user;
- email-only linking is rejected;
- protected route ownership is maintained for two different identities.

### Client tests

- landing content and links render without an API request;
- authenticated root redirects to Today;
- unauthenticated protected routes redirect to login;
- login and sign-up submit through the auth provider;
- a session survives provider initialization;
- sign-out returns to the public root;
- the API request wrapper sends a bearer token when a session exists.

### E2E tests

Playwright uses a deterministic fake-auth adapter only for the E2E process.
The existing database-backed scenarios log in through the browser or attach
the same deterministic test token to API fixtures before exercising their
current flows. A new public-flow scenario checks the landing page and the
unauthenticated redirect. No paid AI request is introduced.

## Out of scope

- Google OAuth, Magic Link, phone login, MFA, and account deletion UI;
- changing Prisma's database connection model;
- moving database reads into the browser or Supabase Data API;
- Row Level Security migration;
- new training, cycle, review, or AI behavior;
- CI/CD, deployment, monitoring, billing, and notifications.

## Acceptance criteria

~~~text
Unauthenticated / renders the landing page.
Unauthenticated protected routes redirect to /login.
Authenticated / redirects to /today.
Users can sign up, sign in, refresh, and sign out.
Every protected API request is tied to the validated Supabase identity.
Two users cannot read or mutate each other's data.
Production code has no DEMO_USER_ID fallback.
CORS is environment-configured and not wildcarded.
Fake auth is unavailable in production.
Landing, auth, existing UI tests, E2E collection, typechecks, and build pass.
~~~
