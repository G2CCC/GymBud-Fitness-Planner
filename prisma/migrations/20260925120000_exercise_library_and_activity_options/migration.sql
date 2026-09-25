ALTER TABLE "Exercise"
  ADD COLUMN "sourceProvider" TEXT,
  ADD COLUMN "sourceId" TEXT,
  ADD COLUMN "sourceCommit" TEXT,
  ADD COLUMN "sourceCategory" TEXT,
  ADD COLUMN "level" TEXT,
  ADD COLUMN "primaryMuscles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "secondaryMuscles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "focusAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "instructions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "imagePaths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE UNIQUE INDEX "Exercise_sourceProvider_sourceId_key"
  ON "Exercise"("sourceProvider", "sourceId");

CREATE TABLE "ActivityOption" (
  "id" TEXT NOT NULL,
  "activityType" "ActivityType" NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "iconKey" TEXT NOT NULL,
  "aiEligible" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActivityOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActivityOption_slug_key" ON "ActivityOption"("slug");
CREATE INDEX "ActivityOption_activityType_aiEligible_sortOrder_idx"
  ON "ActivityOption"("activityType", "aiEligible", "sortOrder");

ALTER TABLE "ScheduledWorkout" ADD COLUMN "activityOptionId" TEXT;
CREATE INDEX "ScheduledWorkout_activityOptionId_idx"
  ON "ScheduledWorkout"("activityOptionId");

ALTER TABLE "ScheduledWorkout"
  ADD CONSTRAINT "ScheduledWorkout_activityOptionId_fkey"
  FOREIGN KEY ("activityOptionId") REFERENCES "ActivityOption"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
