# Exercise Library and Activity Catalog Design

- Date: 2026-09-24
- Status: Design approved in conversation; awaiting review of this written spec
- Scope: Strength exercise library, Cardio/Sport activity catalog, image ingestion, AI plan contracts, legacy system-exercise cleanup

## 1. Confirmed product decisions

1. Strength is curated around six user-facing focus areas:
   - Chest
   - Shoulders
   - Back
   - Legs
   - Arms
   - Core
2. Cardio and Sport use the same activity-directory experience in plan creation and workout logging.
3. Strength images are imported into Supabase Storage.
4. Cardio and Sport use lightweight frontend icons rather than image assets.
5. The current seed-only system exercises are removed from the active library and replaced by the curated imported library.
6. Existing user-owned custom exercises remain available.
7. Existing planned workouts and workout history must remain valid. Legacy references are migrated to equivalent imported exercise IDs before old rows are removed.

## 2. Goals

- Provide a small, high-quality strength pool suitable for normal users and AI plan generation.
- Give every selected strength exercise its source metadata, instructions, and two movement images.
- Give Cardio and Sport stable IDs, names, icons, and predictable logging behavior.
- Ensure AI returns only IDs from server-controlled catalog pools.
- Preserve existing workout and log history during system-exercise cleanup.
- Keep catalog seeding and image synchronization idempotent.

## 3. Non-goals

- Importing every record from free-exercise-db.
- Importing stretching, plyometrics, or the source cardio category as Strength actions.
- Building a user-uploaded image system.
- Replacing the existing activity types STRENGTH, CARDIO, and SPORT.
- Allowing AI to invent arbitrary Cardio or Sport names.

## 4. Source and curation policy

The source is yuhonas/free-exercise-db. Its README publishes a combined JSON dataset and image paths under exercises/{sourceId}/; the project README marks the dataset as Unlicense. GymBud will preserve the source provider, source ID, source commit/version, and source URL in the import manifest and development documentation.

The import will select common movements from the source strength-related records rather than importing the whole dataset. Source categories strength, powerlifting, olympic weightlifting, and selected strongman records may contribute actions when the movement is common and useful to ordinary GymBud users. Source category is retained as provenance, not exposed as the primary user-facing focus area.

The first curated release targets 10–12 action slots per focus area and approximately 60–70 unique exercises after deduplication. Selection rules:

- Include beginner-friendly, intermediate, compound, isolation, bodyweight, free-weight, cable, and machine options where available.
- Prefer canonical movements over many small grip or stance variations.
- Exclude duplicate variants, highly specialized strongman movements, and advanced movements from the default AI pool unless they provide clear value.
- Assign one primary focus area and allow additional focus areas for compound movements.
- Require both source images to exist before an exercise is marked ready for the default library.
- Store a manifest keyed by source ID so the selection is reviewable and repeatable.

The six current seed records have explicit migration mappings rather than name-based automatic matching:

| Legacy ID | Imported source record |
| --- | --- |
| system-push-up | Pushups |
| system-bodyweight-squat | Bodyweight_Squat |
| system-plank | Plank |
| system-barbell-bench-press | Barbell_Bench_Press_-_Medium_Grip |
| system-barbell-back-squat | Barbell_Squat |
| system-lat-pulldown | Full_Range-Of-Motion_Lat_Pulldown |

If an existing legacy record is found to have references that cannot be safely mapped, the migration must stop and report the IDs instead of deleting them.

## 5. Domain model

### 5.1 Exercise remains the Strength model

The existing Exercise model continues to represent strength exercises and custom user exercises. It gains metadata fields for:

- source provider and source ID
- source category/version
- primary and secondary muscles
- difficulty/level
- focus areas
- ordered instructions
- image storage paths
- optional image/source metadata

Existing IDs and ownership semantics remain intact. System exercises use ownerId = null. User-created exercises retain ownerId = userId.

The seed/import process must use a stable uniqueness rule based on source provider plus source ID. It must not create a second copy when run repeatedly.

### 5.2 ActivityOption for Cardio and Sport

A new ActivityOption model stores the standard Cardio and Sport directory:

- id
- activityType: CARDIO or SPORT
- slug
- display name
- icon key
- AI eligibility
- display order
- optional description

Cardio and Sport do not use PlannedExercise rows. A ScheduledWorkout receives an optional activityOptionId. The server validates that the selected option exists and that its activity type matches the workout type.

The API may expose Strength exercises and ActivityOptions through separate endpoints, while the client combines them into one catalog experience. Separate persistence models keep strength-specific exercise relationships clear.

### 5.3 Workout data

- Strength continues to use PlannedExercise and PlannedSet.
- Cardio and Sport use activityOptionId for identity.
- plannedDetails continues to hold planned metrics.
- WorkoutLog.actualDetails continues to hold recorded Cardio/Sport metrics.
- Existing free-text modality/sportName fields remain readable for legacy records during migration but are no longer the primary input for new standard activities.
- An Other option is available for manual entry. It is not included in the AI candidate pool and stores a custom display name in the activity details.

## 6. Images and Supabase Storage

Use one public-read bucket for non-sensitive exercise imagery:

- Bucket: exercise-images
- Path pattern: free-exercise-db/{sourceId}/0.jpg
- Path pattern: free-exercise-db/{sourceId}/1.jpg

The database stores relative storage paths, not base64 data and not long-lived GitHub Raw URLs. The API returns resolved public URLs or a stable URL builder result.

The synchronization command must:

1. Read the pinned source manifest.
2. Upsert exercise metadata.
3. Download only selected images.
4. Upload with bounded concurrency.
5. Verify HTTP status, content type, and non-zero file size.
6. Record missing or failed assets.
7. Be safe to run again without duplicating objects or database rows.

The normal application seed should remain fast and deterministic. Image synchronization should be a separate explicit catalog command, while metadata seeding can be invoked by the normal database seed flow.

The server-side storage credential is never exposed to Vite/client code.

## 7. Cardio and Sport seed catalog

Initial Cardio options:

- Treadmill Running
- Incline Treadmill Walking
- Outdoor Running
- Stationary Bike
- Outdoor Cycling
- Rowing Machine
- Elliptical
- Stair Climber
- Air Bike
- Jump Rope
- Hiking
- Ski Erg

Initial Sport options:

- Basketball
- Soccer
- Cricket
- Rugby
- Boxing
- Golf
- Swimming
- Tennis
- Table Tennis
- Badminton
- Bouldering
- Snowboarding
- Volleyball
- Baseball
- Hockey
- Martial Arts
- Skiing
- Surfing

Each list also contains a manual-only Other option.

## 8. Icons

Add lucide-react as the client icon dependency. The database stores stable semantic keys such as BIKE, ROWING_MACHINE, STAIR_CLIMBER, BASKETBALL, BOXING, SWIMMING, and MOUNTAIN. The client owns the key-to-component mapping and provides a generic Activity fallback for unknown keys.

No dynamic component lookup from arbitrary database strings is allowed. Only explicitly mapped icon keys can render.

The icon layer is deliberately approximate for sports without a dedicated pictogram. This keeps the visual language consistent and avoids storing another set of custom assets. Exact sport-specific SVGs can be added later without changing the catalog IDs.

## 9. API and AI contracts

### Catalog

Add server-controlled catalog reads for:

- Strength exercises, optionally filtered by focus area.
- ActivityOptions, filtered by CARDIO or SPORT.

Extend API response types with image URLs, focus areas, instructions, and icon keys as appropriate.

### Plan generation

The AI legal pool contains:

- Curated AI-eligible Strength exercises.
- AI-eligible Cardio ActivityOptions.
- AI-eligible Sport ActivityOptions.

The plan response adds activityOptionId for Cardio/Sport workouts. Server validation requires:

- Strength workouts use legal exercise IDs.
- Cardio/Sport workouts use a legal matching ActivityOption ID.
- Strength workouts do not use ActivityOption IDs as their exercise list.
- AI cannot return an unknown or user-inaccessible ID.

Update weekly-plan and single-day-plan prompt versions after the contract changes.

### Manual creation and logging

- Strength manual planning uses the curated exercise list and focus-area filtering.
- Cardio/Sport manual planning uses ActivityOption cards.
- Cardio/Sport log forms show the selected standard activity rather than asking for free text.
- Existing metric fields remain activity-specific.
- Other supports a deliberate custom-name fallback.

## 10. Legacy cleanup migration

The migration must run in this order:

1. Snapshot the IDs and reference counts of the six legacy system exercises.
2. Ensure the imported equivalents exist.
3. Update PlannedExercise and ExerciseLog references from legacy IDs to imported IDs inside a controlled transaction.
4. Verify no PlannedExercise or ExerciseLog rows still reference a legacy ID.
5. Delete only the six legacy system rows.
6. Remove the old six-item seed list and replace it with the new catalog seed/import.
7. Update fake AI fixtures, tests, docs, and examples that hard-code system-* IDs.
8. Re-run referential-integrity and history tests.

User-owned exercises are not deleted. Existing completed workout logs remain attached to their migrated exercise IDs and keep their original sets, weights, and timestamps.

## 11. Frontend changes

- Upgrade ExercisePicker with search, focus-area filtering, and image thumbnails.
- Add Cardio/Sport option cards with Lucide icons.
- Show selected activity name and icon in Add Session, the workout page, calendar cards, and the details drawer.
- Use the first exercise image for list thumbnails and both images for exercise details.
- Add lazy loading and a default image/icon fallback.
- Keep the activity type labels Strength, Cardio, and Sport while displaying the selected specific activity.

## 12. Verification

Required checks:

- Curated manifest has no duplicate source IDs.
- Every default Strength action has two valid image paths.
- Catalog import is idempotent.
- Legacy references migrate without losing logs or sets.
- Legacy system rows are absent after migration.
- User-owned custom exercises remain available.
- API rejects wrong-type or unknown activity IDs.
- AI output validation rejects illegal exercise/activity IDs.
- Cardio/Sport logging preserves existing metrics.
- Client and server typechecks pass.
- Unit, integration, and UI tests pass.
- Supabase Storage contains exactly the selected image assets needed by the manifest.

## 13. Delivery order

1. Commit the reviewed curated manifest and shared catalog constants.
2. Add the Prisma migration and safe legacy-reference migration.
3. Add metadata seed and Supabase image synchronization.
4. Add catalog API and shared contracts.
5. Update AI prompts, schemas, and server validation.
6. Update manual planning, logging, calendar, and detail UI.
7. Run the full verification suite and deploy the migration/import in order.
8. Commit and push the completed implementation to main after verification.
