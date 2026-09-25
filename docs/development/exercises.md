# Exercise library

## Equipment metadata

Exercises no longer distinguish a Gym from a home workout. An exercise stores
its normalized equipment metadata only. Empty, omitted, or whitespace-only
equipment is normalized to `NONE`, which represents bodyweight training.

## Ownership and AI eligibility

- System exercises have `ownerId = null` and are visible to every user.
- Custom exercises have `ownerId = userId` and are visible only to that user.
- A custom exercise is persisted only after the user confirms the extracted
  metadata. Confirmed custom exercises are marked `aiEligible = true`.
- Future AI plan generation must query the system pool plus the current user's
  eligible custom pool. It must never accept an exercise ID from another user.

## Curated catalog

The curated Strength catalog contains 66 records from the pinned
`free-exercise-db` source commit. Each record has a stable ID, source metadata,
normalized equipment, primary/secondary muscles, instructions, image paths, and
one or more of these six focus areas: `CHEST`, `SHOULDERS`, `BACK`, `LEGS`,
`ARMS`, and `CORE`.

Selection is deterministic: each focus area has 11 primary actions, duplicate
source actions are removed, every selected source record has two images and
instructions, and body-only equipment is normalized to `NONE`. The generated
manifest is committed at `server/src/catalog/data/strength-exercises.ts`.

The normal seed command calls `seedCatalog()` and is idempotent:

```bash
npm run db:seed
```

To regenerate the manifest after changing the pinned source or selection rules:

```bash
npm run catalog:build-manifest
```

Exercise images are uploaded separately to the server-only Supabase Storage
bucket configured by `EXERCISE_IMAGE_BUCKET` (default `exercise-images`):

```bash
npm run catalog:sync-images
```

The image command requires `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. The service-role key is never exposed to the
browser or required by normal API startup.

## Activity catalog

Cardio and Sport use `ActivityOption` records instead of free-text identity.
The seed includes standard options such as `cardio-rowing-machine`,
`cardio-stationary-bike`, `sport-basketball`, and `sport-tennis`. Each option
stores an explicit icon key (`BIKE`, `WAVES`, `CIRCLE_DOT`, `SWORDS`, and so
on) that the client maps to a fixed Lucide icon.

Strength uses exercises and planned sets; Cardio/Sport use an
`activityOptionId` and never create `PlannedExercise` rows. The server checks
that the option exists and matches the broad workout type.

The seed also runs the legacy migration. It rewrites references from the six
old `system-*` rows to their canonical catalog IDs, deletes only ownerless
legacy rows after all references are gone, and preserves user-owned custom
exercises.

## API

The API now resolves the authenticated Supabase identity before calling this
service. The service contract remains user-id scoped, so ownership checks do
not depend on client-supplied identity values.

```text
GET  /api/exercises
GET  /api/exercises/:exerciseId
POST /api/exercises
```

`GET /api/exercises` returns system exercises and the current user's exercises.
The optional service-level `aiEligibleOnly` flag is reserved for AI plan
generation and is not exposed as a client-controlled route parameter.

`POST /api/exercises` accepts only confirmed metadata. The server normalizes a
blank equipment value to `NONE` and sets `aiEligible` to `true`.

## UI behavior

`ExercisePicker` and the strength-plan editor use the same user-available
exercise pool without venue filtering. There is no workout location selector or
location-change endpoint.
