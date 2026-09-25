# Exercise Library and Activity Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Replace the six legacy system exercises with a curated, image-backed Strength library and add stable Cardio/Sport activity options for planning, logging, AI generation, and calendar display.

**Architecture:** Keep Exercise as the Strength-specific model, add ActivityOption for Cardio and Sport, and add an optional activityOptionId relation to ScheduledWorkout. Use a pinned free-exercise-db manifest for curated Strength metadata, Supabase Storage for selected images, and explicit server-side ID validation for all AI and client inputs.

**Tech Stack:** Prisma/PostgreSQL, Supabase Storage, Express, Node/TypeScript, Zod, React, Tailwind, lucide-react, Vitest, Testing Library, Playwright.

**Spec:** docs/superpowers/specs/2026-09-24-exercise-library-and-activity-catalog-design.md

## Global Constraints

- User-facing Strength focus areas are exactly CHEST, SHOULDERS, BACK, LEGS, ARMS, and CORE.
- The first curated Strength release contains 60–70 unique exercises, with 10–12 primary exercises per focus area.
- Use free-exercise-db commit a859101d633a01c4a1a920d6a8ce41dabba0705f as the pinned metadata/image source.
- Store Strength images in the public-read Supabase bucket exercise-images under free-exercise-db/{sourceId}/0.jpg and free-exercise-db/{sourceId}/1.jpg.
- Delete only the six legacy system IDs after references are migrated; never delete user-owned exercises or historical workout data.
- The six legacy mappings are system-push-up -> Pushups, system-bodyweight-squat -> Bodyweight_Squat, system-plank -> Plank, system-barbell-bench-press -> Barbell_Bench_Press_-_Medium_Grip, system-barbell-back-squat -> Barbell_Squat, and system-lat-pulldown -> Full_Range-Of-Motion_Lat_Pulldown.
- Image synchronization is an explicit command and must not make the normal application seed depend on an external network request.
- Store semantic icon keys in the database, map them through an explicit client-side component map, and render Activity as the unknown-key fallback.
- AI may return only server-provided exercise IDs and ActivityOption IDs.
- Other is available for manual Cardio/Sport entry but is excluded from the AI candidate pool.
- Supabase Service Role credentials are server-side/import-script credentials only and must never enter client Vite variables.

## Review Focus

- A legacy exercise referenced by PlannedExercise, ExerciseLog, or AIRecommendation must be remapped before deletion and retain all workout sets, weights, timestamps, and recommendation history; cover this in the legacy migration integration test.
- Re-running metadata seed or image synchronization must not create duplicate database rows or duplicate storage objects; cover this in catalog seed and image-sync tests.
- An unknown activity ID or a valid activity ID with the wrong ActivityType must be rejected by both manual workout creation and AI draft confirmation; cover this in workout-service and plan-service tests.
- A missing image or unknown icon key must produce a reported sync failure or visible fallback, not a broken UI; cover this in image-sync and ActivityIcon tests.
- Existing legacy Cardio/Sport free-text details and user-owned custom exercises must remain readable and available while new records use stable catalog IDs; cover this in compatibility and API tests.

## File and Responsibility Map

New source and data files:

- scripts/catalog/source.ts — pinned source URL, source commit, raw dataset fetch, and source record type.
- scripts/catalog/strength-selection.ts — the reviewed list of selected source IDs and curated focus-area assignments.
- scripts/catalog/build-strength-manifest.ts — validates the selection and generates the checked-in typed manifest.
- server/src/catalog/data/strength-exercises.ts — generated, deterministic selected Strength metadata.
- server/src/catalog/activity-options.ts — Cardio/Sport seed options and icon keys.
- server/src/catalog/seed.ts — idempotent Strength and ActivityOption metadata seed.
- server/src/catalog/legacy-migration.ts — transactional remapping and deletion of the six legacy system exercises.
- server/src/catalog/storage-sync.ts — dependency-injected image download/upload synchronization.
- server/src/catalog/service.ts — catalog queries and ownership/type filtering.
- server/src/routes/activity-options/route.ts — authenticated ActivityOption list endpoint.
- shared/src/domain/catalog/types.ts — shared focus-area, icon-key, and catalog record types.
- shared/src/domain/catalog/validation.ts — shared Zod schemas for catalog filters and activity IDs.
- client/src/components/catalog/ActivityIcon.tsx — explicit icon-key-to-Lucide mapping.
- client/src/components/catalog/ActivityOptionPicker.tsx — reusable Cardio/Sport option picker.
- scripts/sync-exercise-images.ts — command-line entry point for image synchronization.
- prisma/migrations/20260925120000_exercise_library_and_activity_options/migration.sql — schema migration generated from the Prisma model change.
- server/tests/catalog/manifest.test.ts — selection and generated-manifest invariants.
- server/tests/catalog/seed.test.ts — metadata and ActivityOption idempotency.
- server/tests/catalog/image-sync.test.ts — mocked image sync behavior.
- server/tests/catalog/legacy-migration.test.ts — reference preservation and legacy deletion.
- server/tests/integration/activity-options.test.ts — authenticated ActivityOption API behavior.
- client/tests/ui/catalog.test.tsx — picker, icon fallback, and image fallback behavior.

Existing files to modify:

- prisma/schema.prisma
- prisma/seed.ts
- package.json
- .env.example
- server/package.json
- server/src/config/env.ts
- server/src/exercises/service.ts
- server/src/routes/exercises/route.ts
- server/src/routes/index.ts
- server/src/workouts/service.ts
- server/src/routes/workouts/route.ts
- server/src/calendar/service.ts
- shared/src/index.ts
- shared/src/domain/types.ts
- shared/src/domain/calendar/types.ts
- shared/src/domain/workouts/validation.ts
- shared/src/domain/exercises/validation.ts
- server/src/ai/schemas.ts
- server/src/ai/prompts/plan.ts
- server/src/ai/prompts/day-plan.ts
- server/src/ai/plan-service.ts
- server/src/ai/fake-client.ts
- client/package.json
- client/src/api/client.ts
- client/src/api/contracts.ts
- client/src/api/validation.ts
- client/src/components/exercises/ExercisePicker.tsx
- client/src/components/workouts/StrengthPlanBuilder.tsx
- client/src/components/calendar/AddSessionPanel.tsx
- client/src/components/calendar/GenerateDayPlanPanel.tsx
- client/src/components/calendar/SingleDayPlanDraftEditor.tsx
- client/src/components/onboarding/InitialPlanDraftEditor.tsx
- client/src/components/review/NextCycleDraftEditor.tsx
- client/src/components/workouts/CardioLogForm.tsx
- client/src/components/workouts/SportLogForm.tsx
- client/src/components/workouts/WorkoutEditor.tsx
- client/src/pages/workouts/WorkoutPage.tsx
- client/src/components/calendar/WorkoutCard.tsx
- client/src/components/calendar/WorkoutDetailsDrawer.tsx
- client/src/components/calendar/CalendarGrid.tsx
- docs/development/exercises.md
- docs/development/ai-plans.md
- tests/e2e/support/global-setup.ts
- all tests and fixtures that hard-code system-* exercise IDs

Delete after all imports and fixtures are migrated:

- server/src/exercises/seed.ts

---

### Task 1: Create the pinned source and curated Strength manifest

**Files:**
- Create: scripts/catalog/source.ts
- Create: scripts/catalog/strength-selection.ts
- Create: scripts/catalog/build-strength-manifest.ts
- Create: server/src/catalog/data/strength-exercises.ts
- Create: shared/src/domain/catalog/types.ts
- Create: shared/src/domain/catalog/validation.ts
- Modify: shared/src/index.ts
- Modify: package.json
- Test: server/tests/catalog/manifest.test.ts

**Interfaces:**

- scripts/catalog/source.ts exports FREE_EXERCISE_DB_COMMIT, FREE_EXERCISE_DB_JSON_URL, and fetchExerciseDb(): Promise<readonly SourceExercise[]>.
- scripts/catalog/strength-selection.ts exports selectedStrengthExercises: readonly SelectedStrengthSelection[].
- server/src/catalog/data/strength-exercises.ts exports selectedStrengthExercises: readonly StrengthCatalogSeed[].
- shared/src/domain/catalog/types.ts exports StrengthFocusArea, strengthFocusAreas, ActivityIconKey, activityIconKeys, and ActivityOptionType.
- shared/src/domain/catalog/validation.ts exports strengthFocusAreaSchema and activityOptionTypeSchema.

- [ ] **Step 1: Write the failing manifest invariant test**

Create a test that imports the generated manifest and asserts the actual catalog contract:

~~~ts
import { describe, expect, it } from "vitest";
import {
  selectedStrengthExercises,
  type StrengthCatalogSeed,
} from "../../src/catalog/data/strength-exercises";

const focusAreas = ["CHEST", "SHOULDERS", "BACK", "LEGS", "ARMS", "CORE"] as const;

describe("curated Strength manifest", () => {
  it("contains 60 to 70 unique source records", () => {
    const ids = selectedStrengthExercises.map((exercise) => exercise.sourceId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(60);
    expect(ids.length).toBeLessThanOrEqual(70);
  });

  it("contains 10 to 12 primary actions for every focus area", () => {
    for (const focusArea of focusAreas) {
      const count = selectedStrengthExercises.filter(
        (exercise) => exercise.primaryFocusArea === focusArea,
      ).length;
      expect(count).toBeGreaterThanOrEqual(10);
      expect(count).toBeLessThanOrEqual(12);
    }
  });

  it("requires both source images and stable metadata", () => {
    for (const exercise of selectedStrengthExercises as readonly StrengthCatalogSeed[]) {
      expect(exercise.sourceId).toBeTruthy();
      expect(exercise.name).toBeTruthy();
      expect(exercise.images).toHaveLength(2);
      expect(exercise.focusAreas.length).toBeGreaterThanOrEqual(1);
      expect(exercise.instructions.length).toBeGreaterThanOrEqual(1);
    }
  });
});
~~~

- [ ] **Step 2: Run the focused test and verify it fails**

Run: npm test -- server/tests/catalog/manifest.test.ts

Expected: FAIL because the catalog manifest and shared catalog types do not exist yet.

- [ ] **Step 3: Define shared catalog types and source metadata**

Use these exact shapes:

~~~ts
export const strengthFocusAreas = [
  "CHEST",
  "SHOULDERS",
  "BACK",
  "LEGS",
  "ARMS",
  "CORE",
] as const;

export type StrengthFocusArea = (typeof strengthFocusAreas)[number];

export const activityIconKeys = [
  "ACTIVITY",
  "BIKE",
  "FOOTPRINTS",
  "MOUNTAIN",
  "TROPHY",
  "WAVES",
  "TARGET",
  "CIRCLE_DOT",
  "SWORDS",
  "SNOWFLAKE",
] as const;

export type ActivityIconKey = (typeof activityIconKeys)[number];
export type ActivityOptionType = "CARDIO" | "SPORT";

export type StrengthCatalogSeed = {
  id: string;
  sourceProvider: "free-exercise-db";
  sourceId: string;
  sourceCommit: string;
  sourceCategory: string;
  name: string;
  description: string | null;
  equipment: string | null;
  level: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  targetMuscles: string[];
  movementPattern: string | null;
  instructions: string[];
  images: string[];
  primaryFocusArea: StrengthFocusArea;
  focusAreas: StrengthFocusArea[];
  imagePaths: string[];
  aiEligible: boolean;
};
~~~

Use source.ts to pin the dataset to commit a859101d633a01c4a1a920d6a8ce41dabba0705f and construct image URLs from that same commit. Do not fetch main at runtime.

- [ ] **Step 4: Add the explicit curated selection**

Populate strength-selection.ts with the reviewed source IDs, one primary focus area per record, and any secondary focus areas. Select canonical common movements from the source strength, powerlifting, olympic weightlifting, and selected strongman categories. Do not select stretching, plyometrics, or source cardio records for this Strength manifest.

- [ ] **Step 5: Implement the manifest builder**

build-strength-manifest.ts must:

1. Fetch the pinned JSON once.
2. Index records by sourceId.
3. Reject duplicate selections.
4. Reject missing source IDs.
5. Reject records outside the allowed source categories.
6. Reject records without exactly two image paths.
7. Normalize body-only equipment to NONE.
8. Generate stable IDs in the form free-exercise-db- plus the source ID.
9. Generate imagePaths using free-exercise-db/{sourceId}/0.jpg and /1.jpg.
10. Write server/src/catalog/data/strength-exercises.ts as a typed exported constant.

Add the root script:

~~~json
{
  "catalog:build-manifest": "tsx scripts/catalog/build-strength-manifest.ts"
}
~~~

- [ ] **Step 6: Run the builder and focused tests**

Run:

~~~bash
npm run catalog:build-manifest
npm test -- server/tests/catalog/manifest.test.ts
npm run typecheck
~~~

Expected: the generated manifest satisfies the six-area count, source-image, and uniqueness assertions.

- [ ] **Step 7: Commit the manifest**

~~~bash
git add scripts/catalog server/src/catalog/data shared/src/domain/catalog shared/src/index.ts package.json server/tests/catalog/manifest.test.ts
git commit -m "feat: add curated strength catalog manifest"
~~~

---

### Task 2: Add the Prisma catalog schema and safe legacy-reference migration

**Files:**
- Modify: prisma/schema.prisma
- Create: prisma/migrations/20260925120000_exercise_library_and_activity_options/migration.sql
- Create: server/src/catalog/legacy-migration.ts
- Test: server/tests/catalog/legacy-migration.test.ts
- Test: server/tests/integration/catalog-schema.test.ts

**Interfaces:**

- migrateLegacySystemExercises(prisma: PrismaClient): Promise<{ migratedReferences: number; deletedExercises: number }>.
- The legacy migration operates on the exact six legacy IDs listed in Global Constraints.
- The migration updates PlannedExercise, ExerciseLog, and AIRecommendation references before deleting legacy Exercise rows.

- [ ] **Step 1: Add failing integration tests for reference preservation**

Create a database-backed test that creates:

- one legacy Exercise row,
- one imported canonical Exercise row,
- one PlannedExercise pointing at the legacy row,
- one ExerciseLog pointing at the legacy row,
- one AIRecommendation pointing at the legacy row,
- associated sets and recommendation text.

Call migrateLegacySystemExercises and assert:

~~~ts
expect(result.deletedExercises).toBe(1);
expect(result.migratedReferences).toBe(3);
expect(await db.plannedExercise.findFirstOrThrow()).toMatchObject({
  exerciseId: canonicalExerciseId,
});
expect(await db.exerciseLog.findFirstOrThrow()).toMatchObject({
  exerciseId: canonicalExerciseId,
});
expect(await db.aiRecommendation.findFirstOrThrow()).toMatchObject({
  exerciseId: canonicalExerciseId,
});
expect(await db.setLog.count()).toBe(originalSetCount);
expect(await db.exercise.count({ where: { id: legacyId } })).toBe(0);
~~~

Also assert that an Exercise with ownerId set to a user is never deleted even if its name matches a legacy name.

- [ ] **Step 2: Run the migration test and verify it fails**

Run: npm test -- server/tests/catalog/legacy-migration.test.ts

Expected: FAIL because ActivityOption, the new Exercise metadata fields, and migrateLegacySystemExercises do not exist.

- [ ] **Step 3: Extend prisma/schema.prisma**

Add these Exercise fields with defaults that preserve existing rows:

~~~prisma
sourceProvider  String?
sourceId        String?
sourceCommit    String?
sourceCategory  String?
level           String?
primaryMuscles  String[] @default([])
secondaryMuscles String[] @default([])
focusAreas      String[] @default([])
instructions    String[] @default([])
imagePaths      String[] @default([])

@@unique([sourceProvider, sourceId])
~~~

Add:

~~~prisma
model ActivityOption {
  id               String         @id
  activityType     ActivityType
  slug             String         @unique
  name             String
  iconKey          String
  aiEligible       Boolean        @default(true)
  sortOrder        Int
  description      String?
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
  scheduledWorkouts ScheduledWorkout[]

  @@index([activityType, aiEligible, sortOrder])
}
~~~

Add this optional relation to ScheduledWorkout:

~~~prisma
activityOptionId String?
activityOption   ActivityOption? @relation(fields: [activityOptionId], references: [id], onDelete: Restrict)

@@index([activityOptionId])
~~~

- [ ] **Step 4: Generate and inspect the migration**

Run:

~~~bash
npm run db:generate
npm run db:migrate -- --name exercise_library_and_activity_options
~~~

Inspect the generated SQL and retain it at prisma/migrations/20260925120000_exercise_library_and_activity_options/migration.sql. Confirm the migration adds nullable/defaulted fields and does not delete Exercise, PlannedExercise, ExerciseLog, SetLog, or AIRecommendation rows.

- [ ] **Step 5: Implement the transactional legacy migration**

Use a single Prisma transaction for the six mappings. For each mapping:

~~~ts
await tx.plannedExercise.updateMany({
  where: { exerciseId: legacyId },
  data: { exerciseId: canonicalId },
});
await tx.exerciseLog.updateMany({
  where: { exerciseId: legacyId },
  data: { exerciseId: canonicalId },
});
await tx.aiRecommendation.updateMany({
  where: { exerciseId: legacyId },
  data: { exerciseId: canonicalId },
});
~~~

After updates, query all three reference tables. If any legacy reference remains, throw before deletion. Delete only rows matching the six IDs and ownerId = null. Return the number of updated references and deleted rows.

- [ ] **Step 6: Run schema and migration tests**

Run:

~~~bash
npm run db:generate
npm test -- server/tests/catalog/legacy-migration.test.ts server/tests/integration/catalog-schema.test.ts
npm run typecheck
~~~

Expected: PASS, with all historical set rows and timestamps preserved.

- [ ] **Step 7: Commit the schema and migration**

~~~bash
git add prisma/schema.prisma prisma/migrations server/src/catalog/legacy-migration.ts server/tests/catalog/legacy-migration.test.ts server/tests/integration/catalog-schema.test.ts
git commit -m "feat: add catalog schema and migrate legacy exercises"
~~~

---

### Task 3: Seed curated Strength metadata and Cardio/Sport options

**Files:**
- Create: server/src/catalog/activity-options.ts
- Create: server/src/catalog/seed.ts
- Modify: prisma/seed.ts
- Modify: server/src/exercises/service.ts
- Modify: tests/e2e/support/global-setup.ts
- Modify: server/tests/integration/exercises.test.ts
- Modify: server/tests/ai/exercise-service.test.ts
- Modify: server/tests/ai/plan-service.test.ts
- Modify: server/tests/ai/weight-service.test.ts
- Modify: server/tests/integration/workout-log.test.ts
- Delete: server/src/exercises/seed.ts
- Test: server/tests/catalog/seed.test.ts

**Interfaces:**

- seedCatalog(prisma: PrismaClient): Promise<{ strengthCount: number; activityOptionCount: number }>.
- seedCatalog upserts only curated imported Strength records and the complete ActivityOption list.
- prisma/seed.ts calls seedCatalog(db) and then migrateLegacySystemExercises(db).
- Existing tests import seedCatalog from server/src/catalog/seed.

- [ ] **Step 1: Write the failing seed idempotency test**

Test the actual seed contract:

~~~ts
const first = await seedCatalog(db);
const second = await seedCatalog(db);

expect(second.strengthCount).toBe(first.strengthCount);
expect(
  await db.exercise.count({
    where: { sourceProvider: "free-exercise-db" },
  }),
).toBe(first.strengthCount);
expect(await db.activityOption.count()).toBe(second.activityOptionCount);
expect(
  await db.activityOption.count({
    where: { activityType: "CARDIO" },
  }),
).toBeGreaterThanOrEqual(12);
expect(
  await db.activityOption.count({
    where: { activityType: "SPORT" },
  }),
).toBeGreaterThanOrEqual(18);
~~~

- [ ] **Step 2: Run the seed test and verify it fails**

Run: npm test -- server/tests/catalog/seed.test.ts

Expected: FAIL because seedCatalog and ActivityOption do not exist.

- [ ] **Step 3: Define the exact ActivityOption list**

Create activity-options.ts with stable IDs and icon keys. Use the names from the spec:

- cardio-treadmill-running
- cardio-incline-treadmill-walking
- cardio-outdoor-running
- cardio-stationary-bike
- cardio-outdoor-cycling
- cardio-rowing-machine
- cardio-elliptical
- cardio-stair-climber
- cardio-air-bike
- cardio-jump-rope
- cardio-hiking
- cardio-ski-erg
- sport-basketball
- sport-soccer
- sport-cricket
- sport-rugby
- sport-boxing
- sport-golf
- sport-swimming
- sport-tennis
- sport-table-tennis
- sport-badminton
- sport-bouldering
- sport-snowboarding
- sport-volleyball
- sport-baseball
- sport-hockey
- sport-martial-arts
- sport-skiing
- sport-surfing
- cardio-other
- sport-other

Use aiEligible = false for cardio-other and sport-other, and true for all standard options. Use an explicit icon key for each standard option and ACTIVITY as the fallback.

- [ ] **Step 4: Implement seedCatalog**

For each generated Strength record, upsert by stable ID and update all imported metadata without changing ownerId from null. For each ActivityOption, upsert by id and update name, type, iconKey, sortOrder, and aiEligible.

Do not put image downloads in this function. The metadata seed must work with no network access.

- [ ] **Step 5: Replace the old seed entry point**

Change prisma/seed.ts to:

~~~ts
await seedCatalog(db);
await migrateLegacySystemExercises(db);
console.log("Seeded catalog and migrated legacy system exercises");
~~~

Update E2E setup and all tests to import seedCatalog. Remove the six-item systemExercises constant and delete server/src/exercises/seed.ts after all imports are changed.

- [ ] **Step 6: Update ExerciseService selections**

Extend exerciseSelect with the new metadata fields and ensure listAvailableExercises returns only system imported Strength rows plus the current user's custom rows. System imported rows remain ownerId = null. Add an optional focusArea filter that matches focusAreas array membership.

- [ ] **Step 7: Run seed, tests, and typecheck**

Run:

~~~bash
npm run db:seed
npm test -- server/tests/catalog/seed.test.ts server/tests/integration/exercises.test.ts
npm run typecheck
~~~

Expected: the old six IDs are absent after the seed, imported IDs are available, custom user exercises remain available, and repeated seed runs do not increase row counts.

- [ ] **Step 8: Commit catalog seeding**

~~~bash
git add server/src/catalog server/src/exercises prisma/seed.ts tests/e2e/support/global-setup.ts server/tests
git commit -m "feat: seed curated exercise and activity catalogs"
~~~

---

### Task 4: Add Supabase image synchronization

**Files:**
- Create: server/src/catalog/storage-sync.ts
- Create: scripts/sync-exercise-images.ts
- Modify: server/src/config/env.ts
- Modify: .env.example
- Modify: package.json
- Test: server/tests/catalog/image-sync.test.ts
- Test: server/tests/config/env.test.ts

**Interfaces:**

- syncExerciseImages(manifest, dependencies, options): Promise<ImageSyncSummary>.
- ImageSyncSummary has uploaded, skipped, failed, and failures fields.
- The sync function receives download and upload dependencies so tests never call GitHub or Supabase.

- [ ] **Step 1: Write failing synchronization tests**

Cover:

~~~ts
it("uploads both source images to the configured bucket path", async () => {
  const result = await syncExerciseImages([oneExercise], fakeDependencies);
  expect(result).toMatchObject({ uploaded: 2, skipped: 0, failed: 0 });
  expect(fakeUpload).toHaveBeenNthCalledWith(
    1,
    "free-exercise-db/Pushups/0.jpg",
    expect.any(Uint8Array),
    "image/jpeg",
  );
});

it("reports an unavailable image without aborting other records", async () => {
  const result = await syncExerciseImages([oneGoodExercise, oneMissingExercise], fakeDependencies);
  expect(result.failed).toBe(1);
  expect(result.failures[0]?.sourceId).toBe("missing-source-id");
});
~~~

- [ ] **Step 2: Run the image-sync tests and verify they fail**

Run: npm test -- server/tests/catalog/image-sync.test.ts

Expected: FAIL because the synchronizer and environment fields do not exist.

- [ ] **Step 3: Extend server environment configuration**

Add to AppEnv and loadEnv:

~~~ts
supabaseServiceRoleKey: string;
exerciseImageBucket: string;
~~~

Read SUPABASE_SERVICE_ROLE_KEY and default EXERCISE_IMAGE_BUCKET to exercise-images. Require the Service Role key only when the image-sync command creates its Supabase Storage client; normal authenticated API startup must continue using the anon key.

Add to .env.example:

~~~dotenv
SUPABASE_SERVICE_ROLE_KEY=
EXERCISE_IMAGE_BUCKET=exercise-images
~~~

- [ ] **Step 4: Implement dependency-injected synchronization**

Use these dependency interfaces:

~~~ts
type ImageDownloader = (
  url: string,
) => Promise<{ bytes: Uint8Array; contentType: string }>;

type ImageUploader = (
  bucket: string,
  path: string,
  bytes: Uint8Array,
  contentType: string,
) => Promise<void>;
~~~

Use a concurrency limit of four. Treat non-2xx responses, empty bodies, and non-image content types as failures. Upload with upsert enabled. Continue processing after an individual failure and return a complete summary.

- [ ] **Step 5: Implement the CLI entry point**

scripts/sync-exercise-images.ts must:

1. Load the generated manifest.
2. Build pinned raw URLs from FREE_EXERCISE_DB_COMMIT.
3. Create a Supabase client with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
4. Call syncExerciseImages with the exercise-image bucket.
5. Print uploaded/skipped/failed counts.
6. Set process.exitCode = 1 if any asset failed.

Add:

~~~json
{
  "catalog:sync-images": "tsx scripts/sync-exercise-images.ts"
}
~~~

- [ ] **Step 6: Run tests and the local command**

Run:

~~~bash
npm test -- server/tests/catalog/image-sync.test.ts server/tests/config/env.test.ts
npm run catalog:sync-images
~~~

Expected: unit tests PASS. The sync command either uploads the selected assets or exits with a clear configuration/network error; it must never silently report success when an image failed.

- [ ] **Step 7: Commit image synchronization**

~~~bash
git add server/src/catalog/storage-sync.ts scripts/sync-exercise-images.ts server/src/config/env.ts .env.example package.json server/tests/catalog/image-sync.test.ts server/tests/config/env.test.ts
git commit -m "feat: sync exercise images to Supabase Storage"
~~~

---

### Task 5: Expose catalog APIs and shared client contracts

**Files:**
- Create: server/src/catalog/service.ts
- Create: server/src/routes/activity-options/route.ts
- Modify: server/src/routes/exercises/route.ts
- Modify: server/src/routes/index.ts
- Modify: client/src/api/client.ts
- Modify: client/src/api/contracts.ts
- Modify: client/src/api/validation.ts
- Modify: shared/src/domain/catalog/types.ts
- Test: server/tests/integration/activity-options.test.ts
- Test: server/tests/integration/exercises.test.ts

**Interfaces:**

- ExerciseService.listAvailableExercises(userId, options?: { aiEligibleOnly?: boolean; focusArea?: StrengthFocusArea }): Promise<ExerciseRecord[]>.
- ActivityCatalogService.listActivityOptions(activityType?: ActivityOptionType): Promise<ActivityOptionRecord[]>.
- GET /api/exercises?focusArea=CHEST returns system Strength exercises and current-user custom exercises.
- GET /api/activity-options?activityType=CARDIO|SPORT returns standard options ordered by sortOrder.
- client listExercises(focusArea?: StrengthFocusArea): Promise<ApiExercise[]>.
- client listActivityOptions(activityType: "CARDIO" | "SPORT"): Promise<ApiActivityOption[]>.

- [ ] **Step 1: Add failing API tests**

Cover authenticated ownership and filters:

~~~ts
const strengthResponse = await request(app)
  .get("/api/exercises?focusArea=CHEST")
  .set("Authorization", testAuthorizationHeader);

expect(strengthResponse.status).toBe(200);
expect(
  strengthResponse.body.data.every((exercise: ApiExercise) =>
    exercise.focusAreas.includes("CHEST"),
  ),
).toBe(true);

const cardioResponse = await request(app)
  .get("/api/activity-options?activityType=CARDIO")
  .set("Authorization", testAuthorizationHeader);

expect(cardioResponse.status).toBe(200);
expect(
  cardioResponse.body.data.every(
    (option: ApiActivityOption) => option.activityType === "CARDIO",
  ),
).toBe(true);
~~~

Add a test proving a user cannot see another user's custom exercise.

- [ ] **Step 2: Run the API tests and verify they fail**

Run: npm test -- server/tests/integration/activity-options.test.ts server/tests/integration/exercises.test.ts

Expected: FAIL because the new query fields, route, and client response types do not exist.

- [ ] **Step 3: Define the response types**

Use:

~~~ts
export type ApiExercise = {
  id: string;
  name: string;
  description: string | null;
  equipment: string | null;
  targetMuscles: string[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
  focusAreas: StrengthFocusArea[];
  instructions: string[];
  imageUrls: string[];
  aiEligible: boolean;
};

export type ApiActivityOption = {
  id: string;
  activityType: "CARDIO" | "SPORT";
  name: string;
  iconKey: ActivityIconKey;
  aiEligible: boolean;
  sortOrder: number;
  description: string | null;
};
~~~

The API may resolve imageUrls from stored imagePaths using the public bucket URL. Never return Service Role credentials or raw upload credentials.

- [ ] **Step 4: Implement catalog service and routes**

Implement focus-area filtering with a Prisma has filter against Exercise.focusAreas. Validate the query string with shared Zod schemas. Mount ActivityOptionRouter at /api/activity-options and require the same authenticated-user middleware behavior as /api/exercises.

Return options in sortOrder order, then name order.

- [ ] **Step 5: Update client API functions**

Keep listExercises as the existing call site name but add an optional focusArea argument. Add listActivityOptions. Parse all query results through the existing request helper and return typed data.

- [ ] **Step 6: Run tests and typecheck**

Run:

~~~bash
npm test -- server/tests/integration/activity-options.test.ts server/tests/integration/exercises.test.ts
npm run typecheck
~~~

Expected: PASS, with system Strength exercises, custom user exercises, activity filters, image URLs, and icon keys correctly scoped.

- [ ] **Step 7: Commit catalog API contracts**

~~~bash
git add server/src/catalog/service.ts server/src/routes/activity-options server/src/routes/exercises server/src/routes/index.ts client/src/api shared/src/domain/catalog server/tests/integration
git commit -m "feat: expose exercise and activity catalogs"
~~~

---

### Task 6: Enforce ActivityOption identity in workout creation and calendar reads

**Files:**
- Modify: shared/src/domain/workouts/validation.ts
- Modify: shared/src/domain/types.ts
- Modify: shared/src/domain/calendar/types.ts
- Modify: server/src/workouts/service.ts
- Modify: server/src/routes/workouts/route.ts
- Modify: server/src/calendar/service.ts
- Modify: client/src/api/contracts.ts
- Modify: client/src/api/client.ts
- Modify: client/src/api/validation.ts
- Test: shared/tests/domain/workout-validation.test.ts
- Test: server/tests/integration/workout-log.test.ts
- Test: server/tests/integration/calendar.test.ts

**Interfaces:**

- CreateWorkoutInput includes activityOptionId?: string.
- CARDIO and SPORT creation requires a valid activityOptionId with the matching ActivityType.
- STRENGTH creation rejects activityOptionId and continues to validate PlannedExercise rows.
- ApiWorkout and ApiCalendarWorkout expose activityOption: ApiActivityOption | null.
- Legacy records with a null activityOptionId remain readable.

- [ ] **Step 1: Write failing validation tests**

Add:

~~~ts
it("requires a Cardio activity option", () => {
  expect(
    createWorkoutInputSchema.safeParse({
      activityType: "CARDIO",
      scheduledDate: "2026-09-25",
      durationMinutes: 30,
    }).success,
  ).toBe(false);
});

it("rejects a Sport option on a Cardio workout", () => {
  expect(
    createWorkoutInputSchema.safeParse({
      activityType: "CARDIO",
      activityOptionId: "sport-basketball",
      scheduledDate: "2026-09-25",
      durationMinutes: 30,
    }).success,
  ).toBe(false);
});
~~~

- [ ] **Step 2: Run validation tests and verify they fail**

Run: npm test -- shared/tests/domain/workout-validation.test.ts

Expected: FAIL because createWorkoutInputSchema does not know activityOptionId.

- [ ] **Step 3: Update shared workout validation**

Add activityOptionId to createWorkoutInputSchema and enforce:

~~~ts
if (input.activityType === "STRENGTH" && input.activityOptionId) {
  context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["activityOptionId"],
    message: "Strength workouts cannot use an activity option",
  });
}

if (input.activityType !== "STRENGTH" && !input.activityOptionId) {
  context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["activityOptionId"],
    message: "Cardio and Sport workouts require an activity option",
  });
}
~~~

- [ ] **Step 4: Validate the option in WorkoutService**

Before creating a non-Strength workout, load ActivityOption by ID and verify activityType. Throw WorkoutServiceError with code VALIDATION_ERROR and status 400 for an unknown or mismatched option. Include the relation in workoutSelect, getWorkoutInTransaction, and the calendar summary select.

- [ ] **Step 5: Update calendar service and API contracts**

Add activityOption fields to CalendarWorkoutSummary, ApiCalendarWorkout, and ApiWorkout. Preserve null for legacy rows. Keep activityType as the top-level broad category.

- [ ] **Step 6: Run integration tests**

Run:

~~~bash
npm test -- shared/tests/domain/workout-validation.test.ts server/tests/integration/workout-log.test.ts server/tests/integration/calendar.test.ts
npm run typecheck
~~~

Expected: Strength behavior remains valid, Cardio/Sport require matching catalog IDs, and calendar responses include option details without breaking legacy rows.

- [ ] **Step 7: Commit workout identity enforcement**

~~~bash
git add shared/src/domain/workouts shared/src/domain/types.ts shared/src/domain/calendar/types.ts server/src/workouts server/src/calendar client/src/api server/tests/integration shared/tests/domain/workout-validation.test.ts
git commit -m "feat: attach catalog activities to workouts"
~~~

---

### Task 7: Update AI schemas, prompts, and plan confirmation

**Files:**
- Modify: server/src/ai/schemas.ts
- Modify: server/src/ai/prompts/plan.ts
- Modify: server/src/ai/prompts/day-plan.ts
- Modify: server/src/ai/plan-service.ts
- Modify: server/src/ai/fake-client.ts
- Modify: client/src/api/contracts.ts
- Modify: client/src/api/validation.ts
- Modify: server/src/reviews/service.ts
- Test: server/tests/ai/plan-service.test.ts
- Test: server/tests/ai/day-plan-prompt.test.ts
- Test: server/tests/ai/fake-client.test.ts
- Test: client/tests/ui/onboarding.test.tsx

**Interfaces:**

- PlanResponse workout records include activityOptionId?: string.
- PlanDraft workout records include activityOptionId, activityOptionName, and activityOptionIconKey for Cardio/Sport.
- PlanService.getLegalExercises(userId) returns only AI-eligible Strength exercises.
- PlanService.getLegalActivityOptions() returns only AI-eligible standard Cardio/Sport options.
- PlanService validates every returned exercise and activity option before producing a draft or confirming it.

- [ ] **Step 1: Add failing schema tests**

Cover valid and invalid branches:

~~~ts
it("accepts a Cardio plan workout with an activity option and no exercises", () => {
  expect(
    planResponseSchema.safeParse({
      workouts: [{
        scheduledDate: "2026-09-25",
        activityType: "CARDIO",
        activityOptionId: "cardio-rowing-machine",
        durationMinutes: 30,
        plannedDetails: { intensity: "MODERATE" },
        exercises: [],
      }],
    }).success,
  ).toBe(true);
});

it("rejects a Cardio plan workout without an activity option", () => {
  expect(
    planResponseSchema.safeParse({
      workouts: [{
        scheduledDate: "2026-09-25",
        activityType: "CARDIO",
        durationMinutes: 30,
        exercises: [],
      }],
    }).success,
  ).toBe(false);
});
~~~

- [ ] **Step 2: Run AI tests and verify they fail**

Run: npm test -- server/tests/ai/plan-service.test.ts server/tests/ai/day-plan-prompt.test.ts

Expected: FAIL because the response schemas and prompt input do not include ActivityOptions.

- [ ] **Step 3: Update plan schemas**

Add activityOptionId to planWorkoutSchema. Add a superRefine that requires:

- STRENGTH: activityOptionId absent, exercises at least one.
- CARDIO/SPORT: activityOptionId present, exercises empty.
- plannedDetails remains an object when supplied.

Extend planDraftWorkoutSchema with server-enriched display fields that the client can show but the AI does not generate.

- [ ] **Step 4: Update prompt inputs**

Extend PlanPromptInput with:

~~~ts
activityOptions: Array<{
  id: string;
  activityType: "CARDIO" | "SPORT";
  name: string;
}>;
~~~

Extend exercise prompt records with focusAreas. Update PLAN_PROMPT_VERSION and the day-plan prompt version. Include the exact output shape:

~~~json
{
  "activityType": "CARDIO",
  "activityOptionId": "cardio-rowing-machine",
  "durationMinutes": 30,
  "plannedDetails": { "intensity": "MODERATE" },
  "exercises": []
}
~~~

Keep the instruction that the model may use only supplied IDs.

- [ ] **Step 5: Update PlanService generation and confirmation**

Load legal Strength exercises and legal ActivityOptions separately. Pass both pools into the prompt. In buildDraft, resolve activityOptionId to name and icon key. Reject any returned ActivityOption ID that is missing, not AI-eligible, or mismatched with activityType. Keep the existing client-editable PlanDraft flow.

When confirming a plan, pass activityOptionId into ScheduledWorkout.create. Do not create PlannedExercise rows for Cardio or Sport. Keep the single-day endpoint Strength-only and reject any non-Strength result from that endpoint.

- [ ] **Step 6: Update fake AI fixtures and client validation**

Replace hard-coded system-* IDs in fake clients and tests with canonical imported IDs. Add at least one fake Cardio response and one fake Sport response. Update clientPlanDraftSchema and API contracts to validate/display activityOption fields.

- [ ] **Step 7: Run AI, review, and UI tests**

Run:

~~~bash
npm test -- server/tests/ai/plan-service.test.ts server/tests/ai/day-plan-prompt.test.ts server/tests/ai/fake-client.test.ts client/tests/ui/onboarding.test.tsx
npm run typecheck
~~~

Expected: Strength plans continue to work, Cardio/Sport drafts contain stable IDs, invalid IDs are rejected before persistence, and review-generated next-cycle drafts remain valid.

- [ ] **Step 8: Commit AI contract changes**

~~~bash
git add server/src/ai server/src/reviews/service.ts client/src/api client/tests/ui/onboarding.test.tsx server/tests/ai
git commit -m "feat: constrain AI plans to activity catalogs"
~~~

---

### Task 8: Add the Lucide icon layer and catalog pickers

**Files:**
- Modify: client/package.json
- Create: client/src/components/catalog/ActivityIcon.tsx
- Create: client/src/components/catalog/ActivityOptionPicker.tsx
- Modify: client/src/components/exercises/ExercisePicker.tsx
- Modify: client/src/components/workouts/StrengthPlanBuilder.tsx
- Modify: client/src/components/calendar/AddSessionPanel.tsx
- Modify: client/src/api/client.ts
- Test: client/tests/ui/catalog.test.tsx
- Test: client/tests/ui/workout.test.tsx

**Interfaces:**

- ActivityIcon({ iconKey, label, size }): JSX.Element.
- ActivityOptionPicker({ options, value, onChange, label }): JSX.Element.
- ExercisePickerOption includes id, name, equipment, focusAreas, and imageUrl.
- AddSessionPanel loads ActivityOptions for CARDIO/Sport and sends activityOptionId to createWorkout.

- [ ] **Step 1: Add the dependency and failing UI tests**

Add lucide-react to client/package.json at the current approved major version, then write tests for:

~~~tsx
render(<ActivityIcon iconKey="BIKE" label="Stationary Bike" />);
expect(screen.getByLabelText("Stationary Bike")).toBeInTheDocument();

render(<ActivityIcon iconKey={"UNKNOWN" as ActivityIconKey} label="Fallback" />);
expect(screen.getByLabelText("Fallback")).toBeInTheDocument();

render(
  <ActivityOptionPicker
    options={[stationaryBikeOption]}
    value=""
    onChange={onChange}
  />,
);
await user.click(screen.getByRole("button", { name: /stationary bike/i }));
expect(onChange).toHaveBeenCalledWith("cardio-stationary-bike");
~~~

- [ ] **Step 2: Run the UI tests and verify they fail**

Run: npm test -- client/tests/ui/catalog.test.tsx

Expected: FAIL because lucide-react, ActivityIcon, and ActivityOptionPicker do not exist.

- [ ] **Step 3: Implement explicit icon mapping**

Import only the selected Lucide components. Keep the map typed and provide Activity as fallback:

~~~tsx
const iconMap: Record<ActivityIconKey, LucideIcon> = {
  ACTIVITY: Activity,
  BIKE: Bike,
  FOOTPRINTS: Footprints,
  MOUNTAIN: Mountain,
  TROPHY: Trophy,
  WAVES: Waves,
  TARGET: Target,
  CIRCLE_DOT: CircleDot,
  SWORDS: Swords,
  SNOWFLAKE: Snowflake,
};

export function ActivityIcon({
  iconKey,
  label,
  size = 20,
}: {
  iconKey: string;
  label: string;
  size?: number;
}) {
  const Icon = iconMap[iconKey as ActivityIconKey] ?? Activity;
  return <Icon aria-label={label} role="img" size={size} aria-hidden={false} />;
}
~~~

- [ ] **Step 4: Implement the Cardio/Sport picker**

Render accessible buttons/cards with the option name, icon, and selected state. Do not dynamically resolve a component from a database string. The picker must work with keyboard focus and expose aria-pressed.

- [ ] **Step 5: Upgrade StrengthPicker and AddSessionPanel**

Add focus-area filtering and image thumbnails to ExercisePicker. Use imageUrl as a lazy-loaded thumbnail and show a neutral fallback when absent.

In AddSessionPanel:

- Load Strength exercises only for STRENGTH.
- Load Cardio options only for CARDIO.
- Load Sport options only for SPORT.
- Require an option selection for Cardio/Sport.
- Include activityOptionId in createWorkout.
- Keep StrengthPlanBuilder for Strength only.

- [ ] **Step 6: Run focused UI tests and typecheck**

Run:

~~~bash
npm install
npm test -- client/tests/ui/catalog.test.tsx client/tests/ui/workout.test.tsx
npm run typecheck
~~~

Expected: PASS, with accessible icon fallback, option selection, Strength image fallback, and correct create payloads.

- [ ] **Step 7: Commit catalog picker UI**

~~~bash
git add client/package.json client/package-lock.json client/src/components/catalog client/src/components/exercises/ExercisePicker.tsx client/src/components/workouts/StrengthPlanBuilder.tsx client/src/components/calendar/AddSessionPanel.tsx client/tests/ui
git commit -m "feat: add catalog pickers and activity icons"
~~~

---

### Task 9: Display catalog activities in plans, logs, calendar, and details

**Files:**
- Modify: client/src/components/calendar/GenerateDayPlanPanel.tsx
- Modify: client/src/components/calendar/SingleDayPlanDraftEditor.tsx
- Modify: client/src/components/onboarding/InitialPlanDraftEditor.tsx
- Modify: client/src/components/review/NextCycleDraftEditor.tsx
- Modify: client/src/components/workouts/CardioLogForm.tsx
- Modify: client/src/components/workouts/SportLogForm.tsx
- Modify: client/src/components/workouts/WorkoutEditor.tsx
- Modify: client/src/pages/workouts/WorkoutPage.tsx
- Modify: client/src/components/calendar/WorkoutCard.tsx
- Modify: client/src/components/calendar/WorkoutDetailsDrawer.tsx
- Modify: client/src/components/calendar/CalendarGrid.tsx
- Modify: client/src/pages/calendar/CalendarPage.tsx
- Modify: server/src/calendar/service.ts
- Modify: server/src/workouts/service.ts
- Test: client/tests/ui/catalog.test.tsx
- Test: client/tests/ui/workout.test.tsx
- Test: client/tests/ui/calendar.test.tsx

**Interfaces:**

- ApiWorkout.activityOption is present for standard Cardio/Sport workouts and null for legacy records.
- ApiCalendarWorkout.activityOption is present for standard Cardio/Sport workouts and null for legacy records.
- CardioLogForm and SportLogForm receive the selected option as a prop and use legacy free-text details only when the option is null.
- Calendar and drawer components render broad type plus specific activity name/icon.

- [ ] **Step 1: Write failing display and logging tests**

Cover:

~~~tsx
expect(screen.getByText("Rowing Machine")).toBeInTheDocument();
expect(screen.getByLabelText("Rowing Machine")).toBeInTheDocument();
expect(screen.getByText("Legacy Cardio")).toBeInTheDocument();
~~~

The first two assertions cover standard catalog data; the third covers a legacy workout with null activityOption and modality in actualDetails.

- [ ] **Step 2: Run UI tests and verify they fail**

Run: npm test -- client/tests/ui/catalog.test.tsx client/tests/ui/workout.test.tsx client/tests/ui/calendar.test.tsx

Expected: FAIL because the current components render only broad activityType labels and accept free-text Cardio/Sport names.

- [ ] **Step 3: Update draft editors**

When a plan draft workout has activityOptionId, render its enriched name and icon. Keep Strength exercise editing unchanged except for image-backed exercise details. Ensure initial onboarding, single-day generation, and next-cycle review drafts all use the same display helper.

- [ ] **Step 4: Update CardioLogForm and SportLogForm**

Remove standard new-entry free-text as the primary control. Display the selected catalog option. Keep duration, distance/pace/speed, intensity, and notes fields. If a legacy workout has no option, show the existing modality/sportName as read-only context and allow the existing log payload to remain valid.

- [ ] **Step 5: Update calendar cards and details drawer**

Use activityOption.name and ActivityIcon when available. Keep Strength as the broad label and show its planned exercise names in the drawer. Use a generic Activity icon and broad label for legacy null-option Cardio/Sport records.

- [ ] **Step 6: Run UI and client build checks**

Run:

~~~bash
npm test -- client/tests/ui/catalog.test.tsx client/tests/ui/workout.test.tsx client/tests/ui/calendar.test.tsx
npm run build --workspace @fitness/client
~~~

Expected: standard catalog activities are visible throughout planning, logging, calendar, and details; legacy records remain readable; no broken icon or image renders occur.

- [ ] **Step 7: Commit catalog display and logging UI**

~~~bash
git add client/src/components client/src/pages server/src/calendar/service.ts server/src/workouts/service.ts client/tests/ui
git commit -m "feat: show catalog activities across workout flows"
~~~

---

### Task 10: Finish documentation, fixture migration, and full verification

**Files:**
- Modify: docs/development/exercises.md
- Modify: docs/development/ai-plans.md
- Modify: docs/development/workouts.md
- Modify: server/src/ai/fake-client.ts
- Modify: server/tests/ai/fake-client.test.ts
- Modify: server/tests/ai/day-plan-prompt.test.ts
- Modify: server/tests/ai/exercise-service.test.ts
- Modify: server/tests/ai/plan-service.test.ts
- Modify: server/tests/ai/weight-service.test.ts
- Modify: server/tests/integration/workout-log.test.ts
- Modify: shared/tests/domain/workout-validation.test.ts
- Modify: tests/e2e/support/global-setup.ts
- Modify: README.md if catalog commands need top-level setup documentation
- Test: all existing test suites

- [ ] **Step 1: Search for remaining legacy IDs and seed references**

Run:

~~~bash
rg -n "system-(push-up|bodyweight-squat|plank|barbell-bench-press|barbell-back-squat|lat-pulldown)|seedSystemExercises|server/src/exercises/seed" .
~~~

Expected: no production seed/import references remain. Any remaining test fixture reference must be replaced with its canonical imported ID in this task.

- [ ] **Step 2: Update development documentation**

Document:

- six Strength focus areas and curated manifest rules;
- catalog:build-manifest and catalog:sync-images commands;
- Supabase Storage bucket and required server-only environment variables;
- ActivityOption IDs and icon-key mapping;
- legacy migration behavior;
- Other manual-entry behavior;
- the fact that custom user exercises are preserved.

- [ ] **Step 3: Run the complete verification sequence**

Run:

~~~bash
npm run db:generate
npm run typecheck
npm test
npm run build --workspace @fitness/client
npm run build --workspace @fitness/server
npm run catalog:build-manifest
npm run db:seed
npm run catalog:sync-images
npm test:e2e
~~~

Expected:

- all packages typecheck;
- all unit and integration tests pass;
- client and server build;
- metadata seed is idempotent;
- image sync reports zero failures;
- legacy system rows are absent;
- user-owned custom exercises remain;
- E2E can create Strength, Cardio, and Sport sessions.

- [ ] **Step 4: Verify the remote database in read-only queries**

Before production deployment, verify:

~~~sql
SELECT id
FROM "Exercise"
WHERE id IN (
  'system-push-up',
  'system-bodyweight-squat',
  'system-plank',
  'system-barbell-bench-press',
  'system-barbell-back-squat',
  'system-lat-pulldown'
);

SELECT COUNT(*)
FROM "Exercise"
WHERE "sourceProvider" = 'free-exercise-db';

SELECT "activityType", COUNT(*)
FROM "ActivityOption"
GROUP BY "activityType";
~~~

Expected: the first query returns zero rows, the Strength count is between 60 and 70, and Cardio/Sport counts match the seeded catalog including their manual-only Other options.

- [ ] **Step 5: Commit documentation and verification updates**

~~~bash
git add docs README.md server/src/ai server/tests shared/tests tests/e2e
git commit -m "test: verify unified exercise and activity catalog"
~~~

- [ ] **Step 6: Push only after verification**

~~~bash
git push origin main
~~~

Record the pushed commit SHA and summarize the migration, seed, storage sync, and test results.

## Self-review against the spec

- Curated Strength scope: Task 1 creates and tests the six-area manifest.
- Strength metadata and images: Tasks 1, 3, and 4.
- Cardio/Sport option catalog: Tasks 3 and 5.
- Supabase Storage: Task 4.
- Legacy cleanup without history loss: Task 2 and Task 3.
- AI ID contracts: Tasks 6 and 7.
- Manual planning/logging/calendar UI: Tasks 8 and 9.
- Custom exercise preservation and legacy compatibility: Tasks 2, 5, 6, and 9.
- Tests and deployment verification: Task 10.

The plan contains no unresolved design placeholder. The only user-facing data artifact created during implementation is the explicit curated source-ID manifest, which is validated by its own count, category, uniqueness, and image-completeness tests before the database seed can use it.
