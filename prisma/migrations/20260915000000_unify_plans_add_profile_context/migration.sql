-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY');

-- AlterTable
ALTER TABLE "UserProfile"
ADD COLUMN "gender" "Gender",
ADD COLUMN "age" INTEGER,
ADD COLUMN "heightCm" DOUBLE PRECISION,
ADD COLUMN "weightKg" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ScheduledWorkout" DROP COLUMN "source";

-- DropEnum
DROP TYPE "WorkoutSource";
