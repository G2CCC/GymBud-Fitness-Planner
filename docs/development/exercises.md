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

## Seed data

`seedSystemExercises()` is called by the normal seed command and is idempotent:

```bash
npm run db:seed
```

The seed contains bodyweight examples (`Push-up`, `Bodyweight Squat`, and
`Plank`) and equipment examples (`Barbell Bench Press`, `Barbell Back Squat`,
and `Lat Pulldown`). All exercises use the same pool regardless of workout
venue.

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
