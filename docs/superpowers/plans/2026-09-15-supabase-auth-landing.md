# Supabase Auth and Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use the checkbox syntax - [ ].

**Goal:** Replace the demo-user request path with authenticated Supabase users and add a public landing page that routes visitors into the protected GymBud app.

**Architecture:** Supabase Auth owns browser sessions and email/password credentials. Express validates each bearer token, maps the external Supabase user id to the existing internal User row, and exposes the mapped application id to the existing ownership-checked services. React Router separates a public landing/auth surface from the existing protected App shell; the landing page performs no API request.

**Tech Stack:** React 19, React Router, Vite, TypeScript, Express 5, Prisma 6, PostgreSQL/Supabase, @supabase/supabase-js, Zod, Vitest, Testing Library, Playwright.

**Spec:** docs/superpowers/specs/2026-09-15-supabase-auth-landing-design.md

## Global Constraints

- Authentication method is email/password Supabase Auth only; no OAuth or Magic Link in this task.
- Protected API requests require an Authorization bearer token.
- The public /health endpoint remains unauthenticated; all /api business routes require authentication.
- User.id remains the internal primary key; User.authUserId String? @unique maps it to Supabase Auth.
- Existing service ownership checks remain in place and no client-supplied user id becomes authoritative.
- DEMO_USER_ID is removed from production request handling; deterministic fake auth is test-only.
- The landing page uses existing design tokens, has no protected data dependency, and supports 320px layouts and keyboard focus.
- Never add database URLs, service-role keys, or other secrets to VITE_* variables.
- Every production-code change has a failing test first, except dependency and static configuration edits that cannot execute independently.

---

### Task 1: Add the identity mapping and validated auth configuration

**Files:**
- Modify: prisma/schema.prisma
- Create: prisma/migrations/20260915120000_add_supabase_auth_user_mapping/migration.sql
- Modify: server/src/config/env.ts
- Modify: .env.example
- Modify: server/package.json
- Modify: client/package.json
- Modify: package-lock.json
- Modify: server/tests/config/env.test.ts
- Modify: prisma/seed.ts
- Modify: server/tests/integration/seed.test.ts

**Interfaces:**
- Produces User.authUserId: string | null with a unique database constraint.
- Produces loadEnv(source?: NodeJS.ProcessEnv): AppEnv and the exported env value.
- AppEnv.authProvider is "supabase" or "fake"; production rejects "fake".
- AppEnv.corsOrigins is a string array parsed from CORS_ORIGINS.
- @supabase/supabase-js is available to both the client and server workspaces.

- [ ] **Step 1: Write failing configuration tests**

Add tests to server/tests/config/env.test.ts that exercise a pure loader rather than mutating the imported singleton:

~~~ts
it("parses Supabase auth configuration and comma-separated CORS origins", async () => {
  const { loadEnv } = await import("../../src/config/env");
  const result = loadEnv({
    NODE_ENV: "development",
    AUTH_PROVIDER: "supabase",
    SUPABASE_URL: "https://gymbud.supabase.co",
    SUPABASE_ANON_KEY: "public-key",
    CORS_ORIGINS: "http://localhost:5173, https://gymbud.example.com",
  });

  expect(result.authProvider).toBe("supabase");
  expect(result.supabaseUrl).toBe("https://gymbud.supabase.co");
  expect(result.corsOrigins).toEqual([
    "http://localhost:5173",
    "https://gymbud.example.com",
  ]);
});

it("rejects fake auth in production", async () => {
  const { loadEnv } = await import("../../src/config/env");

  expect(() =>
    loadEnv({ NODE_ENV: "production", AUTH_PROVIDER: "fake" }),
  ).toThrow(/fake.*production/i);
});
~~~

- [ ] **Step 2: Run the focused tests and verify the expected failure**

Run:

~~~bash
npm test -- server/tests/config/env.test.ts
~~~

Expected: FAIL because loadEnv, auth provider parsing, and production fake-auth protection do not exist.

- [ ] **Step 3: Install the Supabase client dependencies**

Run:

~~~bash
npm install @supabase/supabase-js --workspace @fitness/client
npm install @supabase/supabase-js --workspace @fitness/server
~~~

Keep the lockfile changes and do not install @supabase/ssr; this is a Vite SPA, not an SSR application.

- [ ] **Step 4: Add the Prisma mapping and migration**

Add the nullable unique field:

~~~prisma
model User {
  id         String  @id @default(cuid())
  authUserId String? @unique
  email      String  @unique
  // existing fields and relations remain unchanged
}
~~~

Generate the migration from the repository root:

~~~bash
npm run db:migrate -- --name add_supabase_auth_user_mapping
~~~

The generated SQL must add only the nullable authUserId column and its unique index. It must not delete users or rewrite foreign keys.

- [ ] **Step 5: Implement the environment loader**

Implement the following shape in server/src/config/env.ts:

~~~ts
export type AuthProvider = "supabase" | "fake";

export type AppEnv = {
  nodeEnv: string;
  apiUrl: string;
  databaseUrl: string;
  directUrl: string;
  authProvider: AuthProvider;
  supabaseUrl: string;
  supabaseAnonKey: string;
  corsOrigins: string[];
  e2eAuthEnabled: boolean;
  aiApiKey: string;
  aiBaseUrl: string;
  aiModel: string;
  aiProvider: string;
};

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv;
~~~

Use AUTH_PROVIDER=fake automatically only when NODE_ENV=test; require E2E_AUTH_ENABLED=true for a non-test fake-auth process; throw if fake auth is selected in production. Require SUPABASE_URL and SUPABASE_ANON_KEY when the selected provider is Supabase. Default development CORS to http://localhost:5173 and split configured values on commas after trimming.

- [ ] **Step 6: Restrict demo seeding to explicit test setup**

Change prisma/seed.ts so the normal database seed inserts system exercises but does not create a production demo user. Move the existing profile fixture logic into an explicitly named seedTestUser(userId: string) helper used by E2E setup and database tests. Set its authUserId to test: plus the supplied userId so fake-auth requests resolve the seeded row.

Update server/tests/integration/seed.test.ts to call seedTestUser("seed-test-user") and assert the mapped id and profile. Do not leave a runtime function that silently chooses DEMO_USER_ID.

- [ ] **Step 7: Run the task tests and inspect the migration**

Run:

~~~bash
npm test -- server/tests/config/env.test.ts server/tests/integration/seed.test.ts
npx prisma validate --schema prisma/schema.prisma
git diff --check
~~~

Expected: configuration and seed tests pass when database variables are available; the seed integration test remains database-gated like the existing suite. Inspect that the migration is additive and ownership relations are unchanged.

- [ ] **Step 8: Commit the identity foundation**

~~~bash
git add prisma server/src/config/env.ts server/package.json client/package.json package-lock.json .env.example server/tests/config/env.test.ts server/tests/integration/seed.test.ts
git commit -m "feat: add authenticated user identity mapping"
~~~

### Task 2: Implement server token verification and request authentication

**Files:**
- Create: server/src/auth/types.ts
- Create: server/src/auth/supabase-verifier.ts
- Create: server/src/auth/fake-verifier.ts
- Create: server/src/auth/application-user.ts
- Create: server/src/auth/middleware.ts
- Create: server/tests/auth/verifier.test.ts
- Create: server/tests/auth/middleware.test.ts
- Modify: server/src/routes/index.ts
- Modify: server/src/index.ts
- Modify: server/src/current-user.ts
- Modify: server/package.json
- Modify: package-lock.json

**Interfaces:**
- AuthIdentity = { providerUserId: string; email: string }.
- AuthRequestContext = { userId: string; providerUserId: string; email: string }.
- AuthVerifier.verify(accessToken: string): Promise<AuthIdentity>.
- resolveApplicationUser(identity: AuthIdentity): Promise<AuthRequestContext>.
- createAuthMiddleware(options?: { verifier?: AuthVerifier; resolveUser?: (identity: AuthIdentity) => Promise<AuthRequestContext> }): RequestHandler.
- getAuthenticatedUserId(request: Request): string.

- [ ] **Step 1: Write failing verifier tests**

Create server/tests/auth/verifier.test.ts with these behaviors:

~~~ts
it("rejects an empty access token", async () => {
  const verifier = new FakeAuthVerifier();
  await expect(verifier.verify("")).rejects.toMatchObject({ code: "AUTH_INVALID" });
});

it("maps the deterministic test token to its identity", async () => {
  const verifier = new FakeAuthVerifier();
  await expect(verifier.verify("test-token:e2e-user")).resolves.toEqual({
    providerUserId: "test:e2e-user",
    email: "e2e-user@example.test",
  });
});
~~~

Use an AuthError with code and statusCode fields so route middleware can return stable API errors.

- [ ] **Step 2: Run the verifier tests and verify the expected failure**

Run:

~~~bash
npm test -- server/tests/auth/verifier.test.ts
~~~

Expected: FAIL because the auth types and verifiers do not exist.

- [ ] **Step 3: Implement the Supabase and fake verifiers**

SupabaseAuthVerifier creates a server-side Supabase client from env.supabaseUrl and env.supabaseAnonKey. Its method calls the authenticated-user lookup with the request token and returns the Supabase user id plus a required email. Missing user or missing email becomes AUTH_INVALID.

FakeAuthVerifier accepts exactly the test-token:e2e-user shape, where the suffix is a lowercase slug, and returns providerUserId test:e2e-user and e2e-user@example.test for that example. It rejects every other token. createConfiguredAuthVerifier selects the implementation from env.authProvider and cannot select fake auth in production.

- [ ] **Step 4: Write failing middleware tests**

Create an Express test app using an injected verifier and an injected user resolver. Test the real HTTP behavior:

~~~ts
it("returns 401 when the authorization header is missing", async () => {
  const app = createTestApp(createAuthMiddleware({
    verifier,
    resolveUser: async () => ({
      userId: "app-user-1",
      providerUserId: "test:e2e-user",
      email: "e2e-user@example.test",
    }),
  }));
  const response = await request(app).get("/protected");
  expect(response.status).toBe(401);
  expect(response.body.error.code).toBe("AUTH_REQUIRED");
});

it("attaches the mapped application user to a valid request", async () => {
  const app = createTestApp(createAuthMiddleware({
    verifier,
    resolveUser: async () => ({
      userId: "app-user-1",
      providerUserId: "test:e2e-user",
      email: "e2e-user@example.test",
    }),
  }));
  const response = await request(app)
    .get("/protected")
    .set("Authorization", "Bearer test-token:e2e-user");

  expect(response.body.data.userId).toBe("app-user-1");
});
~~~

Add supertest and its type package to the server workspace for these HTTP tests. The protected test route must read getAuthenticatedUserId(request) rather than a test-only header.

Install the test dependency with:

~~~bash
npm install --save-dev supertest @types/supertest --workspace @fitness/server
~~~

- [ ] **Step 5: Run the middleware tests and verify the expected failure**

Run:

~~~bash
npm test -- server/tests/auth/middleware.test.ts
~~~

Expected: FAIL because the middleware, request context, and standardized auth errors do not exist.

- [ ] **Step 6: Implement application-user resolution**

Implement resolveApplicationUser(identity) with this order:

1. findUnique where authUserId equals identity.providerUserId;
2. if found, update its email only on that same row when the email changed;
3. if not found, check for an existing User with the same email and no authUserId; return AUTH_USER_CONFLICT rather than linking it;
4. otherwise create a new User with authUserId and email.

Return the internal User.id in AuthRequestContext. Keep this operation idempotent for repeated requests from the same identity.

- [ ] **Step 7: Implement the middleware and protect the API router**

The middleware must:

~~~ts
const authorization = request.header("authorization");
const token = authorization?.match(/^Bearer\\s+(.+)$/i)?.[1];
if (!token) return sendAuthError(response, new AuthError("AUTH_REQUIRED", 401));

const identity = await verifier.verify(token);
const context = await resolveApplicationUser(identity);
request.auth = context;
return next();
~~~

Add apiRouter.use(createAuthMiddleware()) before business routers. Keep /health outside apiRouter. Add the Express request type declaration directly in server/src/auth/types.ts, and make getAuthenticatedUserId throw a server-side error if a route is mounted without the middleware.

- [ ] **Step 8: Run the server auth tests**

Run:

~~~bash
npm test -- server/tests/auth/verifier.test.ts server/tests/auth/middleware.test.ts
npm run typecheck --workspace @fitness/server
~~~

Expected: all auth tests pass and the server typecheck remains green.

- [ ] **Step 9: Commit the server auth boundary**

~~~bash
git add server/src/auth server/src/current-user.ts server/src/routes/index.ts server/src/index.ts server/tests/auth server/package.json package-lock.json
git commit -m "feat: authenticate API requests with Supabase users"
~~~

### Task 3: Migrate every route to request-scoped identity and configurable CORS

**Files:**
- Modify: server/src/routes/profile/route.ts
- Modify: server/src/routes/cycles/route.ts
- Modify: server/src/routes/cycles/[cycleId]/review/route.ts
- Modify: server/src/routes/cycles/[cycleId]/batch-review/route.ts
- Modify: server/src/routes/cycles/[cycleId]/next-draft/route.ts
- Modify: server/src/routes/workouts/route.ts
- Modify: server/src/routes/exercises/route.ts
- Modify: server/src/routes/ai/plans/route.ts
- Modify: server/src/routes/ai/exercises/extract/route.ts
- Modify: server/src/routes/ai/exercises/weight/route.ts
- Modify: server/src/routes/ai/weight-recommendations/route.ts
- Modify: server/src/routes/ai/workouts/replace/route.ts
- Modify: server/src/index.ts
- Create: server/tests/auth/route-ownership.test.ts

**Interfaces:**
- Every route obtains its user id through getAuthenticatedUserId(request).
- No route imports getCurrentUserId or reads an environment user id.
- CORS allows only env.corsOrigins plus requests without an Origin header.

- [ ] **Step 1: Write failing route ownership tests**

With a database-gated test app and two fake tokens, create two application users and assert:

~~~ts
it("does not expose one user's profile to another identity", async () => {
  const userA = await seedTestUser("user-a");
  await db.userProfile.update({
    where: { userId: userA.userId },
    data: { primaryGoal: "FAT_LOSS" },
  });

  const response = await request(app)
    .get("/api/profile")
    .set("Authorization", "Bearer test-token:user-b");

  expect(response.status).toBe(200);
  expect(response.body.data).toBeNull();
});
~~~

Add a second test that user B cannot fetch or mutate a workout id owned by user A and receives the existing ownership-safe error shape.

- [ ] **Step 2: Run the ownership tests and verify the expected failure**

Run:

~~~bash
npm test -- server/tests/auth/route-ownership.test.ts
~~~

Expected: FAIL or be database-skipped until route identity migration and fake-auth database setup are implemented. If it fails before reaching the ownership assertion, fix the test harness first.

- [ ] **Step 3: Replace fixed-user calls in all route handlers**

Change each route handler from:

~~~ts
const userId = await getCurrentUserId();
~~~

to:

~~~ts
const userId = getAuthenticatedUserId(request);
~~~

Do not change service method signatures or domain behavior. This keeps the authentication change at the HTTP boundary and preserves the existing ownership checks.

- [ ] **Step 4: Make CORS environment-driven**

Replace the hard-coded origin in server/src/index.ts with an allowlist callback using env.corsOrigins:

~~~ts
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin is not allowed"));
  },
  allowedHeaders: ["Content-Type", "Authorization"],
}));
~~~

Keep health checks available and do not use origin: "*".

- [ ] **Step 5: Run route ownership and regression tests**

Run:

~~~bash
npm test -- server/tests/auth/route-ownership.test.ts server/tests/integration
npm run typecheck --workspace @fitness/server
~~~

Expected: all non-database tests pass; database-gated tests pass when Supabase variables are present; no route still references the demo user:

~~~bash
rg -n "getCurrentUserId|DEMO_USER_ID|demoUserId" server/src
~~~

Expected search result: no production route reference. Test-only fixture references may remain under tests/e2e until Task 6 renames them.

- [ ] **Step 6: Commit the request identity migration**

~~~bash
git add server/src/routes server/src/index.ts server/tests/auth/route-ownership.test.ts
git commit -m "refactor: use request-scoped application identities"
~~~

### Task 4: Add the browser session provider and authenticated API client

**Files:**
- Create: client/src/auth/client.ts
- Create: client/src/auth/AuthProvider.tsx
- Create: client/src/auth/auth-types.ts
- Create: client/tests/ui/auth-provider.test.tsx
- Modify: client/src/api/client.ts
- Modify: client/src/main.tsx
- Modify: client/package.json
- Modify: package-lock.json

**Interfaces:**
- AuthState = { status: "loading" | "authenticated" | "unauthenticated"; session: Session | null }.
- useAuth(): { state: AuthState; signIn(email: string, password: string): Promise<void>; signUp(email: string, password: string): Promise<{ confirmationRequired: boolean }>; signOut(): Promise<void> }.
- getAccessToken(): Promise<string | null> is a framework-independent client API helper.

- [ ] **Step 1: Write failing provider tests**

Test the provider with an injected fake auth client or module mock:

~~~tsx
it("starts loading and becomes authenticated from the existing session", async () => {
  render(
    <AuthProvider client={createFakeAuthClient({ accessToken: "access-token" })}>
      <AuthStateProbe />
    </AuthProvider>,
  );

  expect(screen.getByRole("status")).toHaveTextContent("Loading");
  expect(await screen.findByText("Authenticated")).toBeInTheDocument();
});

it("reports confirmation required when sign-up returns no session", async () => {
  const result = await signUpWithFakeAuthClient({ session: null });
  expect(result.confirmationRequired).toBe(true);
});
~~~

Define createFakeAuthClient(options) and signUpWithFakeAuthClient(options) inside
this test file using the AuthClient interface exported by the provider. The
factory must implement getSession, onAuthStateChange, signInWithPassword,
signUp, and signOut; the test helper must render a probe that calls the
provider's signUp method and returns its result.

- [ ] **Step 2: Run the provider tests and verify the expected failure**

Run:

~~~bash
npm test -- client/tests/ui/auth-provider.test.tsx
~~~

Expected: FAIL because the provider and client session boundary do not exist.

- [ ] **Step 3: Implement the Supabase browser client and provider**

Create the browser client from VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. In tests, allow an injected auth client so no network request is needed.

The provider must:

1. call auth.getSession() once on mount;
2. subscribe to auth.onAuthStateChange;
3. update loading, authenticated, and unauthenticated states;
4. unsubscribe on unmount;
5. delegate sign-in, sign-up, and sign-out to Supabase;
6. return confirmationRequired: true when sign-up succeeds without a session.

Do not perform an async database or API request inside the auth-state callback.

- [ ] **Step 4: Make the request wrapper attach the access token**

Update client/src/api/client.ts so request() obtains the current token before fetch and merges:

~~~ts
const accessToken = await getAccessToken();
const headers = new Headers(init.headers);
headers.set("Content-Type", "application/json");
if (accessToken) {
  headers.set("Authorization", "Bearer " + accessToken);
}
~~~

Keep the public request function signatures unchanged. Do not put a user id in any request body or query string.

- [ ] **Step 5: Wrap the router with AuthProvider and test the token header**

Render <AuthProvider><RouterProvider router={router} /></AuthProvider> in client/src/main.tsx. Add an API-client test or extend the auth provider test to assert that an authenticated request sends Authorization: Bearer access-token and an unauthenticated request does not invent a header.

- [ ] **Step 6: Run client tests and typecheck**

Run:

~~~bash
npm test -- client/tests/ui/auth-provider.test.tsx
npm run typecheck --workspace @fitness/client
~~~

- [ ] **Step 7: Commit the browser session boundary**

~~~bash
git add client/src/auth client/src/api/client.ts client/src/main.tsx client/tests/ui/auth-provider.test.tsx client/package.json package-lock.json
git commit -m "feat: add browser authentication session"
~~~

### Task 5: Add authentication pages, protected routing, and the Landing Page

**Files:**
- Create: client/src/pages/auth/AuthPage.tsx
- Create: client/src/pages/landing/LandingPage.tsx
- Create: client/src/components/auth/RequireAuth.tsx
- Create: client/src/components/auth/AuthLoadingState.tsx
- Create: client/tests/ui/auth.test.tsx
- Create: client/tests/ui/landing.test.tsx
- Modify: client/src/router.tsx
- Modify: client/src/App.tsx

**Interfaces:**
- AuthPage({ mode }: { mode: "login" | "signup" }).
- LandingPage() renders public content and links to /login and /signup.
- RequireAuth({ children }: { children: ReactNode }) renders loading, redirects to /login, or renders children.
- LandingRoute redirects authenticated users from / to /today.

- [ ] **Step 1: Write failing landing and routing tests**

Create client/tests/ui/landing.test.tsx with these assertions:

~~~tsx
it("renders the public product message and registration calls to action", () => {
  render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );

  expect(screen.getByRole("heading", { name: /train with intention/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /start planning/i })).toHaveAttribute("href", "/signup");
  expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  expect(screen.getByText(/plan.*schedule.*train.*review/i)).toBeInTheDocument();
});

it("does not request protected cycle data", () => {
  render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
  expect(vi.mocked(getCurrentCycle)).not.toHaveBeenCalled();
});
~~~

Create client/tests/ui/auth.test.tsx for:

~~~tsx
it("redirects an unauthenticated protected route to login", async () => {
  render(
    <MemoryRouter initialEntries={["/today"]}>
      <AuthContext.Provider value={unauthenticatedAuthContext}>
        <Routes>
          <Route element={<RequireAuth><TodayPage /></RequireAuth>} path="/today" />
          <Route element={<AuthPage mode="login" />} path="/login" />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
  expect(await screen.findByRole("heading", { name: /sign in/i })).toBeInTheDocument();
});

it("redirects an authenticated root route to Today", async () => {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <AuthContext.Provider value={authenticatedAuthContext}>
        <Routes>
          <Route element={<LandingRoute />} path="/" />
          <Route element={<h1>Today</h1>} path="/today" />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
  expect(await screen.findByRole("heading", { name: "Today" })).toBeInTheDocument();
});
~~~

- [ ] **Step 2: Run the new UI tests and verify the expected failure**

Run:

~~~bash
npm test -- client/tests/ui/landing.test.tsx client/tests/ui/auth.test.tsx
~~~

Expected: FAIL because the public page, auth page, and route guards do not exist.

- [ ] **Step 3: Implement the auth page**

AuthPage must:

- render email and password inputs with labels;
- validate non-empty email and password before submitting;
- call signIn in login mode;
- call signUp in signup mode;
- disable the submit control while pending;
- render a generic error message without token or database details;
- render a confirmation message when sign-up returns without a session;
- link between /login and /signup;
- provide a link back to /.

On successful authentication, navigate to /today. If the provider already reports an authenticated session, redirect without showing the form.

- [ ] **Step 4: Implement the Landing Page**

Use productName and existing Tailwind tokens. Include an accessible header, hero, primary/secondary CTAs, four-step flow, four feature cards, the explicit user-confirmation boundary for AI plans, and a final CTA. Use semantic main, section, and heading levels. Keep every link keyboard-focusable and every CTA at least 44px high. Do not load cycle or profile data.

- [ ] **Step 5: Implement route separation and guards**

Restructure client/src/router.tsx into public and protected surfaces:

~~~tsx
{
  path: "/",
  element: <LandingRoute />,
},
{ path: "/login", element: <AuthPage mode="login" /> },
{ path: "/signup", element: <AuthPage mode="signup" /> },
{
  element: (
    <RequireAuth>
      <App />
    </RequireAuth>
  ),
  children: [
    { path: "today", element: <TodayPage /> },
    // existing protected routes
  ],
}
~~~

Do not render the desktop/sidebar/mobile app navigation around the landing or auth pages. Add a logout control to the existing App shell and return to / after sign-out.

- [ ] **Step 6: Run focused UI tests and inspect mobile semantics**

Run:

~~~bash
npm test -- client/tests/ui/landing.test.tsx client/tests/ui/auth.test.tsx client/tests/ui/today.test.tsx
npm run typecheck --workspace @fitness/client
~~~

Inspect the rendered page at 320px width and verify that the fixed mobile navigation remains present only inside protected app routes.

- [ ] **Step 7: Commit the public and auth UI**

~~~bash
git add client/src/pages/auth client/src/pages/landing client/src/components/auth client/src/router.tsx client/src/App.tsx client/tests/ui/auth.test.tsx client/tests/ui/landing.test.tsx
git commit -m "feat: add public landing and auth routes"
~~~

### Task 6: Update deterministic E2E authentication, documentation, and release checks

**Files:**
- Modify: playwright.config.ts
- Modify: tests/e2e/support/global-setup.ts
- Modify: tests/e2e/support/database.ts
- Modify: tests/e2e/first-cycle.spec.ts
- Modify: tests/e2e/backfill-and-close.spec.ts
- Modify: tests/e2e/location-validation.spec.ts
- Create: tests/e2e/auth-and-landing.spec.ts
- Modify: README.md
- Modify: docs/development/supabase.md
- Modify: docs/superpowers/plans/2026-09-15-e2e-release-readiness.md
- Modify: .env.example

**Interfaces:**
- E2E server uses AUTH_PROVIDER=fake and E2E_AUTH_ENABLED=true only in the Playwright web-server environment.
- E2E fixtures use E2E_USER_ID=e2e-demo-user and Authorization: Bearer test-token:e2e-demo-user.
- Production setup instructions require Supabase Auth variables and never instruct users to set DEMO_USER_ID.

- [ ] **Step 1: Write the public-flow E2E test**

Create tests/e2e/auth-and-landing.spec.ts:

~~~ts
test("shows the public landing page before authentication", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /train with intention/i })).toBeVisible();
  await page.getByRole("link", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\\/login$/);
});
~~~

Add a database-gated test that logs in with the deterministic fake adapter, opens /today, and confirms the API is tied to the E2E user.

- [ ] **Step 2: Run the new E2E test and verify the expected failure**

Run:

~~~bash
npm run typecheck:e2e
npx playwright test tests/e2e/auth-and-landing.spec.ts --list
~~~

Expected: the browser test fails because the current root route does not render the new landing heading and login link.

- [ ] **Step 3: Configure fake auth only for Playwright**

Set these values in the API web-server environment:

~~~text
AUTH_PROVIDER=fake
E2E_AUTH_ENABLED=true
E2E_USER_ID=e2e-demo-user
AI_PROVIDER=fake
~~~

Set these client values for the Vite web server:

~~~text
VITE_AUTH_PROVIDER=fake
VITE_TEST_USER_ID=e2e-demo-user
VITE_API_URL=http://localhost:3000/api
~~~

Update global setup to seed seedTestUser(e2eUserId), reset only that mapped user's data, and delete only that test user during teardown. No E2E helper may set DEMO_USER_ID.

- [ ] **Step 4: Attach the test token to API fixtures and browser auth**

Update createApiContext() to send:

~~~ts
extraHTTPHeaders: {
  Authorization: "Bearer test-token:" + e2eUserId,
}
~~~

Make the fake browser auth adapter produce the same token when the test login form is submitted. Keep the form behavior deterministic and reject fake auth outside the explicit E2E/test environment.

- [ ] **Step 5: Update existing E2E flows**

Ensure first-cycle, backfill/close, and location-validation scenarios authenticate before their API calls and keep their current business assertions unchanged. Add an unauthenticated API assertion that /api/profile returns 401 without the header.

- [ ] **Step 6: Update documentation and configuration examples**

Document:

- creating/configuring a Supabase Auth project;
- adding the web origin to Supabase redirect/origin settings;
- SUPABASE_URL, SUPABASE_ANON_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and CORS_ORIGINS;
- email/password sign-up and email-confirmation behavior;
- fake auth as test-only;
- E2E commands and database requirements;
- the fact that Prisma remains server-only.

Remove instructions that describe DEMO_USER_ID as the normal runtime identity.

- [ ] **Step 7: Run the full test and release checks**

Run:

~~~bash
npm test
npm run typecheck
npm run typecheck:e2e
npx prisma validate --schema prisma/schema.prisma
npx playwright test --list
npm run build --workspace client
git diff --check
~~~

If DATABASE_URL is configured, also run:

~~~bash
npm run test:e2e
~~~

Expected: unit/UI tests and E2E collection pass without a database; database-backed E2E tests pass with fake auth and no paid AI request.

- [ ] **Step 8: Commit the E2E and documentation boundary**

~~~bash
git add playwright.config.ts tests/e2e README.md docs/development/supabase.md docs/superpowers/plans/2026-09-15-e2e-release-readiness.md .env.example
git commit -m "test: cover authenticated browser flows"
~~~

### Task 7: Final review and handoff

**Files:**
- Review all Task 11 changes and generated migration files.

- [ ] **Step 1: Search for prohibited production fallbacks**

Run:

~~~bash
rg -n "DEMO_USER_ID|demoUserId|getCurrentUserId|origin: \\\"http://localhost:5173\\\"" server/src client/src prisma README.md docs
~~~

Expected: no production runtime fallback or hard-coded CORS origin remains. Test-only fake-auth names may appear under test support with an explicit environment boundary.

- [ ] **Step 2: Review ownership and secret boundaries**

Confirm that:

- every /api business route is behind the auth middleware;
- /health remains public;
- the client only reads VITE_* public values;
- no database URL or service-role key appears in client source or build configuration;
- app User.id remains the foreign-key target for all existing records;
- email-only linking is rejected;
- landing and auth routes do not mount the protected App navigation.

- [ ] **Step 3: Run final verification**

Repeat the full checks from Task 6 Step 7 after the final review and record the exact pass/skip counts.

- [ ] **Step 4: Request code review and prepare integration**

Use the repository's code-review workflow, inspect any feedback with tests, then use finishing-a-development-branch to offer merge, push/PR, or leave-branch choices. Do not claim completion before the merged or pushed result has been verified.
