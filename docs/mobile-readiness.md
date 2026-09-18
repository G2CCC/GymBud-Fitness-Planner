# Web-to-iOS readiness boundary

GymBud is intentionally being built as a responsive web app first. The future
iOS client should reuse product rules and API contracts, while implementing
native screens and navigation instead of trying to render the existing DOM UI.

## Reuse directly

The following code is platform-neutral or server-owned and should remain the
source of truth:

- `shared/src/domain`: activity types, equipment metadata, statuses, cycle
  lifecycle, review timing, actual-volume aggregation, and Zod input
  contracts.
- `shared/src/api/contracts.ts`: response shapes shared with a future client.
- Express route contracts under `server/src/routes`.
- Prisma persistence and ownership validation in the server services.
- The API's device-timezone contract. Web reads the computer's IANA timezone;
  iOS will read the phone's system timezone. The server stores the cycle
  timezone snapshot and remains authoritative for instants such as
  `completedAt` and `closedAt`.

The current web fetch wrapper is in `client/src/api/client.ts`. Before adding
the mobile app, extract the request/response logic that does not depend on
`import.meta.env` into a small platform-neutral API package or expose the same
functions through a mobile adapter. Do not copy endpoint validation into a
second, independently evolving implementation.

## Web-only code

The following stays in the web app:

- `client/src/router.tsx` and React Router DOM routes.
- Components that use DOM elements, browser forms, CSS classes, or Tailwind.
- Browser-specific calendar layout, responsive navigation, and keyboard/focus
  behavior.
- Vite environment access through `import.meta.env`.

The iOS app can have different screens for onboarding, calendar, workout
logging, and review. It should call the same server endpoints and submit the
same validated payloads.

## Recommended mobile structure

When iOS work begins, add a separate workspace such as `mobile/` using Expo,
React Native, and Expo Router. Keep screen components native and keep domain
logic out of them:

```text
mobile/
  app/                 # Expo Router screens
  src/api/             # mobile adapter around shared API contracts
  src/components/      # native UI
shared/
  src/domain/          # rules and validation used by both clients
server/
  src/                 # authoritative persistence and AI operations
```

Use `.native.ts` or `.ios.ts` only when a platform-specific implementation is
actually required. A shared implementation should remain the default.

## Compatibility rules for future changes

1. Add or change a domain rule in `shared` or the server service first.
2. Keep HTTP payloads explicit and versionable; clients must not send Prisma
   models or arbitrary database fields.
3. Keep historical cycle and workout records immutable after closure.
4. Test a rule at the shared/service layer before adding a web or mobile
   screen.
5. Do not make the mobile app depend on the web build, DOM, Tailwind, or the
   server's Prisma client.
