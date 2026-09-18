DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "UserProfile"
    WHERE "gender" IS NULL
       OR "age" IS NULL
       OR "heightCm" IS NULL
       OR "weightKg" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot require profile body fields: one or more UserProfile rows still contain NULL gender, age, heightCm, or weightKg';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "SetLog"
    WHERE "actualWeight" IS NULL
       OR "weightUnit" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot require SetLog weight fields: one or more rows still contain NULL actualWeight or weightUnit';
  END IF;
END $$;

ALTER TABLE "UserProfile"
  DROP COLUMN "secondaryOutcome",
  DROP COLUMN "defaultLocation",
  ALTER COLUMN "gender" SET NOT NULL,
  ALTER COLUMN "age" SET NOT NULL,
  ALTER COLUMN "heightCm" SET NOT NULL,
  ALTER COLUMN "weightKg" SET NOT NULL;

ALTER TABLE "ScheduledWorkout"
  DROP COLUMN "location";

ALTER TABLE "Exercise"
  DROP COLUMN "availableLocations";

ALTER TABLE "SetLog"
  ALTER COLUMN "actualWeight" SET NOT NULL,
  ALTER COLUMN "weightUnit" SET NOT NULL;

DROP TYPE "Location";
