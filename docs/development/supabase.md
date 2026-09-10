# Supabase database setup

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

## Local setup

```bash
cp .env.example .env
# Edit .env and fill in DATABASE_URL and DIRECT_URL.

npm install
npm run db:generate
npm run db:migrate -- --name init_gymbud
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
- The current MVP uses Prisma from the server. A Supabase JavaScript client
  is not required until we add Supabase-specific features such as Auth,
  Storage, or Realtime.
- Use a dedicated database role for Prisma in shared or production projects;
  do not use the database owner account for ordinary application traffic.
