-- Add stable per-user cycle numbering and fixed four-cycle review state.
-- Existing rows are retained. Legacy cycle numbers are backfilled by their
-- persisted start date and creation order before the unique index is added.

-- AlterTable
ALTER TABLE "TrainingCycle"
ADD COLUMN "cycleNumber" INTEGER;

WITH ranked_cycles AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "userId"
      ORDER BY "startDate" ASC, "createdAt" ASC, "id" ASC
    )::INTEGER AS "number"
  FROM "TrainingCycle"
)
UPDATE "TrainingCycle" AS cycle
SET "cycleNumber" = ranked."number"
FROM ranked_cycles AS ranked
WHERE cycle."id" = ranked."id";

-- CreateEnum
CREATE TYPE "CycleBatchReviewStatus" AS ENUM (
  'ELIGIBLE',
  'GENERATING',
  'READY',
  'CONFIRMED',
  'RESET_REQUIRED'
);

-- AlterTable
ALTER TABLE "CycleReviewSnapshot"
ADD COLUMN "previousCycleSummary" JSONB,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "CycleReviewSnapshot"
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "CycleBatchReview" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "startCycleNumber" INTEGER NOT NULL,
  "endCycleNumber" INTEGER NOT NULL,
  "status" "CycleBatchReviewStatus" NOT NULL DEFAULT 'ELIGIBLE',
  "processedSummary" TEXT,
  "objectiveSummary" JSONB NOT NULL,
  "conclusions" JSONB,
  "nextCycleDraft" JSONB,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CycleBatchReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingCycle_userId_cycleNumber_key"
ON "TrainingCycle"("userId", "cycleNumber");

CREATE UNIQUE INDEX "CycleBatchReview_userId_startCycleNumber_endCycleNumber_key"
ON "CycleBatchReview"("userId", "startCycleNumber", "endCycleNumber");

CREATE INDEX "CycleBatchReview_userId_status_idx"
ON "CycleBatchReview"("userId", "status");

-- AddForeignKey
ALTER TABLE "CycleBatchReview"
ADD CONSTRAINT "CycleBatchReview_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

