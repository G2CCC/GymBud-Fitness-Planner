DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "TrainingCycle"
    WHERE EXTRACT(EPOCH FROM ("endDate" - "startDate")) / 86400 > 6
  ) THEN
    RAISE EXCEPTION 'Weekly-cycle migration blocked: existing TrainingCycle data uses a cycle longer than seven days. Reset or migrate development data explicitly before applying this migration.';
  END IF;
END $$;

DROP TABLE IF EXISTS "CycleBatchReview";
DROP TYPE IF EXISTS "CycleBatchReviewStatus";
