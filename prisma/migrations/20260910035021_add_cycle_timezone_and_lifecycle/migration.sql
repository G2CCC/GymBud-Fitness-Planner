/*
  Warnings:

  - The values [PAUSED] on the enum `CycleStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "CancellationReason" AS ENUM ('USER', 'AUTO_CYCLE_CLOSE');

-- AlterEnum
BEGIN;
CREATE TYPE "CycleStatus_new" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');
ALTER TABLE "public"."TrainingCycle" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "TrainingCycle" ALTER COLUMN "status" TYPE "CycleStatus_new" USING ("status"::text::"CycleStatus_new");
ALTER TYPE "CycleStatus" RENAME TO "CycleStatus_old";
ALTER TYPE "CycleStatus_new" RENAME TO "CycleStatus";
DROP TYPE "public"."CycleStatus_old";
ALTER TABLE "TrainingCycle" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterTable
ALTER TABLE "ScheduledWorkout" ADD COLUMN     "cancellationReason" "CancellationReason";

-- AlterTable
ALTER TABLE "TrainingCycle" ADD COLUMN     "timezone" TEXT;
