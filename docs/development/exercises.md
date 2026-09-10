# Location-aware exercise library

## Location rules

The MVP has two workout locations:

```text
GYM | HOME
```

Every exercise stores a non-empty `availableLocations` array. A confirmed
bodyweight exercise uses both locations. An exercise that requires equipment is
Gym-only because the MVP does not track a user's home equipment inventory.

| Equipment | Valid locations |
|---|---|
| `NONE`, empty, or omitted | `GYM`, `HOME` |
| Any named equipment, such as `BARBELL` or `CABLE_MACHINE` | `GYM` |

These rules are implemented in `@fitness/shared` by
`validateExerciseLocations`. They are applied by the custom-exercise Zod
schema and again by `ExerciseService` before persistence. The duplicated check
is intentional: route validation gives a useful client error, while the
service protects callers that do not enter through HTTP.

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
`Plank`) for both locations and equipment examples (`Barbell Bench Press`,
`Barbell Back Squat`, and `Lat Pulldown`) for the Gym only.

## API

The current-user adapter is still the MVP demo user adapter. Authentication will
replace that adapter later without changing the service ownership checks.

```text
GET  /api/exercises?location=GYM|HOME
GET  /api/exercises/:exerciseId
POST /api/exercises
```

`GET /api/exercises` returns system exercises and the current user's exercises
whose `availableLocations` contains the requested location. The optional
service-level `aiEligibleOnly` flag is reserved for AI plan generation and is
not exposed as a client-controlled route parameter.

`POST /api/exercises` accepts only confirmed metadata. The server normalizes a
blank equipment value to `NONE`, validates the location invariant, and sets
`aiEligible` to `true`.

## UI behavior

`ExercisePicker` receives the scheduled workout location and filters its options
with the same shared location predicate. The parent also passes the current
selected exercise snapshot when it is not present in the newly fetched list.
If a user changes an existing workout from Gym to Home and its selected
equipment exercise becomes incompatible, the selection remains visible and is
marked as incompatible. The UI does not silently replace it; a later
replacement flow can ask the user to choose a compatible alternative.
