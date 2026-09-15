# Supabase database and Auth setup

GymBud uses Supabase as a hosted PostgreSQL provider. Prisma remains the
application's ORM and migration tool; the React client never connects to
Supabase or PostgreSQL directly.

## Connection roles

The project keeps two PostgreSQL URLs because application traffic and schema
migrations have different connection requirements:

- `DATABASE_URL`: Supabase Session Pooler, normally port `5432`. This is used
  by the long-running Express API.
- `DIRECT_URL`: Supabase direct connection, normally port `5432`. This is used
  by Prisma migrations, introspection, and administration commands.

Copy the exact connection strings from **Supabase Dashboard → Connect** and
replace the password placeholder. If the database password contains reserved
URL characters, URL-encode it before placing it in the connection string.
Keep the SSL option from the dashboard connection string; Supabase recommends
using SSL for database connections.

For an IPv4-only network, use the Supabase Session Pooler connection for
runtime traffic. The direct connection may require IPv6 or Supabase's IPv4
add-on; use the session-mode connection for migration tooling when the direct
endpoint is unreachable.

## Supabase Auth setup

In the Supabase dashboard, enable the Email provider under
**Authentication → Providers**. Decide whether new accounts must confirm their
email; when confirmation is enabled, GymBud displays a confirmation message
after sign-up and waits for the user to sign in.

Under **Authentication → URL Configuration**, add the web origin to the site
URL or additional redirect/origin settings used by the project. For local
development this is normally `http://localhost:5173`; add the deployed web
origin separately for production.

Set the server-side Auth variables:

```text
AUTH_PROVIDER=supabase
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=[PUBLIC-ANON-KEY]
CORS_ORIGINS=http://localhost:5173
```

Set the corresponding Vite variables:

```text
VITE_API_URL=http://localhost:3000/api
VITE_SUPABASE_URL=https://[PROJECT-REF].supabase.co
VITE_SUPABASE_ANON_KEY=[PUBLIC-ANON-KEY]
```

The browser uses the public/anon key to maintain an email/password session.
The Express API validates each bearer token with Supabase Auth and maps that
identity to the existing internal `User` row. Prisma and PostgreSQL remain
server-only. Never put `DATABASE_URL`, `DIRECT_URL`, or a service-role key in
any `VITE_*` variable.

## Local setup

```bash
cp .env.example .env
# Edit .env and fill in DATABASE_URL and DIRECT_URL.

npm install
npm run db:generate
npx prisma migrate deploy --schema prisma/schema.prisma
npm run db:seed
```

Run the real database integration test after the migration and seed complete:

```bash
npm test -- server/tests/integration/seed.test.ts
```

## Security rules

- Never commit `.env` or database passwords.
- Never put a PostgreSQL URL, Supabase service-role key, or database password
  in the React client.
- The Supabase JavaScript client is used for Auth in the browser and for
  server-side bearer-token verification. It is not a database client.
- Use a dedicated database role for Prisma in shared or production projects;
  do not use the database owner account for ordinary application traffic.

## Deterministic E2E Auth

Playwright sets `AUTH_PROVIDER=fake` and `E2E_AUTH_ENABLED=true` only in its
isolated API process. The browser fake adapter creates a deterministic test
token for `E2E_USER_ID`; the server accepts that adapter only outside
production when the explicit E2E flag is present. Do not use fake Auth or an
E2E identity in a deployed environment.
