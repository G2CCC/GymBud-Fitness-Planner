-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "BodyGoal" AS ENUM ('FAT_LOSS', 'MUSCLE_GAIN', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateEnum
CREATE TYPE "EnergyCoverage" AS ENUM ('COMPLETE', 'PARTIAL', 'UNAVAILABLE');

-- AlterTable
ALTER TABLE "UserProfile" DROP COLUMN "gender",
ADD COLUMN     "nutritionStartedOn" VARCHAR(10),
ADD COLUMN     "recordingTimezone" TEXT NOT NULL DEFAULT 'UTC',
ADD COLUMN     "sex" "Sex" NOT NULL,
DROP COLUMN "primaryGoal",
ADD COLUMN     "primaryGoal" "BodyGoal" NOT NULL;

-- AlterTable
ALTER TABLE "WorkoutLog" ADD COLUMN     "completedLocalDate" VARCHAR(10),
ADD COLUMN     "energyCoverage" "EnergyCoverage",
ADD COLUMN     "energyInputs" JSONB,
ADD COLUMN     "energyMethod" TEXT,
ADD COLUMN     "energyVersion" TEXT,
ADD COLUMN     "estimatedCaloriesKcal" INTEGER,
ADD COLUMN     "timezone" TEXT;

-- AlterTable
ALTER TABLE "CycleReviewSnapshot" ADD COLUMN     "nutritionSummary" JSONB;

-- DropEnum
DROP TYPE "Gender";

-- CreateTable
CREATE TABLE "Food" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceProvider" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceRelease" TEXT NOT NULL,
    "kcalPer100g" DECIMAL(14,4) NOT NULL,
    "proteinPer100g" DECIMAL(14,4) NOT NULL,
    "carbsPer100g" DECIMAL(14,4) NOT NULL,
    "fatPer100g" DECIMAL(14,4) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Food_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodPortion" (
    "id" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "sourcePortionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "grams" DECIMAL(14,4) NOT NULL,
    "unitGrams" DECIMAL(14,4) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FoodPortion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutritionTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "effectiveDate" VARCHAR(10) NOT NULL,
    "kcal" INTEGER NOT NULL,
    "proteinG" DECIMAL(12,1) NOT NULL,
    "carbsG" DECIMAL(12,1) NOT NULL,
    "fatG" DECIMAL(12,1) NOT NULL,
    "profileSnapshot" JSONB NOT NULL,
    "algorithmVersion" TEXT NOT NULL,

    CONSTRAINT "NutritionTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutritionDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" VARCHAR(10) NOT NULL,
    "timezone" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NutritionDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "mealType" "MealType" NOT NULL,
    "foodId" TEXT NOT NULL,
    "portionId" TEXT,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "grams" DECIMAL(14,4) NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "per100gSnapshot" JSONB NOT NULL,
    "unitGramsSnapshot" DECIMAL(14,4),
    "kcal" DECIMAL(14,4) NOT NULL,
    "proteinG" DECIMAL(14,4) NOT NULL,
    "carbsG" DECIMAL(14,4) NOT NULL,
    "fatG" DECIMAL(14,4) NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Food_active_name_id_idx" ON "Food"("active", "name", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Food_sourceProvider_sourceRelease_sourceId_key" ON "Food"("sourceProvider", "sourceRelease", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodPortion_foodId_sourcePortionId_key" ON "FoodPortion"("foodId", "sourcePortionId");

-- CreateIndex
CREATE UNIQUE INDEX "NutritionTarget_userId_effectiveDate_key" ON "NutritionTarget"("userId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "NutritionDay_userId_localDate_key" ON "NutritionDay"("userId", "localDate");

-- CreateIndex
CREATE INDEX "FoodLog_dayId_deletedAt_idx" ON "FoodLog"("dayId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FoodLog_userId_clientRequestId_key" ON "FoodLog"("userId", "clientRequestId");

-- AddForeignKey
ALTER TABLE "FoodPortion" ADD CONSTRAINT "FoodPortion_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionTarget" ADD CONSTRAINT "NutritionTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionDay" ADD CONSTRAINT "NutritionDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodLog" ADD CONSTRAINT "FoodLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodLog" ADD CONSTRAINT "FoodLog_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "NutritionDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodLog" ADD CONSTRAINT "FoodLog_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodLog" ADD CONSTRAINT "FoodLog_portionId_fkey" FOREIGN KEY ("portionId") REFERENCES "FoodPortion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

