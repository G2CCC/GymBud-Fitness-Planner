-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('STRENGTH', 'CARDIO', 'SPORT');

-- CreateEnum
CREATE TYPE "Location" AS ENUM ('GYM', 'HOME');

-- CreateEnum
CREATE TYPE "WorkoutStatus" AS ENUM ('PLANNED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkoutSource" AS ENUM ('ORIGINAL', 'EXTRA');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'PAUSED');

-- CreateEnum
CREATE TYPE "WeightUnit" AS ENUM ('KG', 'LB');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "userId" TEXT NOT NULL,
    "primaryGoal" TEXT NOT NULL,
    "secondaryOutcome" TEXT,
    "weeklyTrainingDays" INTEGER NOT NULL,
    "sessionDurationMinutes" INTEGER NOT NULL,
    "defaultLocation" "Location" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "TrainingCycle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'DRAFT',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledWorkout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "activityType" "ActivityType" NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "location" "Location" NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "status" "WorkoutStatus" NOT NULL DEFAULT 'PLANNED',
    "source" "WorkoutSource" NOT NULL DEFAULT 'ORIGINAL',
    "completedAt" TIMESTAMP(3),
    "plannedDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledWorkout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedExercise" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "restSeconds" INTEGER,

    CONSTRAINT "PlannedExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedSet" (
    "id" TEXT NOT NULL,
    "plannedExerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "targetReps" INTEGER NOT NULL,
    "plannedWeight" DOUBLE PRECISION,
    "weightUnit" "WeightUnit",

    CONSTRAINT "PlannedSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutLog" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "actualDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseLog" (
    "id" TEXT NOT NULL,
    "workoutLogId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "ExerciseLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetLog" (
    "id" TEXT NOT NULL,
    "exerciseLogId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "actualReps" INTEGER NOT NULL,
    "actualWeight" DOUBLE PRECISION,
    "weightUnit" "WeightUnit",

    CONSTRAINT "SetLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "equipment" TEXT,
    "targetMuscles" TEXT[],
    "movementPattern" TEXT,
    "availableLocations" "Location"[],
    "aiEligible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRecommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT,
    "workoutId" TEXT,
    "kind" TEXT NOT NULL,
    "recommendedWeight" DOUBLE PRECISION,
    "weightUnit" "WeightUnit",
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inputContext" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleReviewSnapshot" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "processedSummary" TEXT,
    "objectiveSummary" JSONB NOT NULL,
    "conclusions" JSONB NOT NULL,
    "nextCycleDraft" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CycleReviewSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "TrainingCycle_userId_status_idx" ON "TrainingCycle"("userId", "status");

-- CreateIndex
CREATE INDEX "TrainingCycle_userId_startDate_idx" ON "TrainingCycle"("userId", "startDate");

-- CreateIndex
CREATE INDEX "ScheduledWorkout_userId_scheduledDate_idx" ON "ScheduledWorkout"("userId", "scheduledDate");

-- CreateIndex
CREATE INDEX "ScheduledWorkout_cycleId_status_idx" ON "ScheduledWorkout"("cycleId", "status");

-- CreateIndex
CREATE INDEX "ScheduledWorkout_userId_status_idx" ON "ScheduledWorkout"("userId", "status");

-- CreateIndex
CREATE INDEX "PlannedExercise_exerciseId_workoutId_idx" ON "PlannedExercise"("exerciseId", "workoutId");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedExercise_workoutId_sortOrder_key" ON "PlannedExercise"("workoutId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedSet_plannedExerciseId_setNumber_key" ON "PlannedSet"("plannedExerciseId", "setNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutLog_workoutId_key" ON "WorkoutLog"("workoutId");

-- CreateIndex
CREATE INDEX "ExerciseLog_exerciseId_workoutLogId_idx" ON "ExerciseLog"("exerciseId", "workoutLogId");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseLog_workoutLogId_sortOrder_key" ON "ExerciseLog"("workoutLogId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SetLog_exerciseLogId_setNumber_key" ON "SetLog"("exerciseLogId", "setNumber");

-- CreateIndex
CREATE INDEX "Exercise_ownerId_name_idx" ON "Exercise"("ownerId", "name");

-- CreateIndex
CREATE INDEX "AIRecommendation_exerciseId_createdAt_idx" ON "AIRecommendation"("exerciseId", "createdAt");

-- CreateIndex
CREATE INDEX "AIRecommendation_userId_createdAt_idx" ON "AIRecommendation"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CycleReviewSnapshot_cycleId_key" ON "CycleReviewSnapshot"("cycleId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCycle" ADD CONSTRAINT "TrainingCycle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledWorkout" ADD CONSTRAINT "ScheduledWorkout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledWorkout" ADD CONSTRAINT "ScheduledWorkout_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "TrainingCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedExercise" ADD CONSTRAINT "PlannedExercise_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "ScheduledWorkout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedExercise" ADD CONSTRAINT "PlannedExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedSet" ADD CONSTRAINT "PlannedSet_plannedExerciseId_fkey" FOREIGN KEY ("plannedExerciseId") REFERENCES "PlannedExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutLog" ADD CONSTRAINT "WorkoutLog_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "ScheduledWorkout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_workoutLogId_fkey" FOREIGN KEY ("workoutLogId") REFERENCES "WorkoutLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetLog" ADD CONSTRAINT "SetLog_exerciseLogId_fkey" FOREIGN KEY ("exerciseLogId") REFERENCES "ExerciseLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "ScheduledWorkout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleReviewSnapshot" ADD CONSTRAINT "CycleReviewSnapshot_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "TrainingCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
