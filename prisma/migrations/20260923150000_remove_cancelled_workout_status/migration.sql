/*
  Cancelled workouts are no longer part of the product model. Remove the
  historical rows before replacing the enum so planned-workout deletion also
  cleans up their dependent plans, logs, and recommendations via the existing
  foreign-key actions.
*/
DELETE FROM "ScheduledWorkout"
WHERE "status" = 'CANCELLED';

ALTER TABLE "ScheduledWorkout"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "WorkoutStatus" RENAME TO "WorkoutStatus_old";

CREATE TYPE "WorkoutStatus" AS ENUM ('PLANNED', 'COMPLETED');

ALTER TABLE "ScheduledWorkout"
  ALTER COLUMN "status" TYPE "WorkoutStatus"
  USING ("status"::text::"WorkoutStatus");

ALTER TABLE "ScheduledWorkout"
  ALTER COLUMN "status" SET DEFAULT 'PLANNED';

DROP TYPE "WorkoutStatus_old";
