import type { Prisma } from "@prisma/client";
import {
  nutritionDateRange,
  type NutritionWindow,
  type NutritionDayDto,
} from "@fitness/shared";
import { readNutritionDay } from "./day";
export async function loadCycleNutrition(
  tx: Prisma.TransactionClient,
  userId: string,
  window: NutritionWindow,
): Promise<NutritionDayDto[]> {
  const profile = await tx.userProfile.findUnique({
    where: { userId },
    select: { recordingTimezone: true },
  });
  const days: NutritionDayDto[] = [];
  for (const date of nutritionDateRange(window))
    days.push(
      await readNutritionDay(
        tx,
        userId,
        date,
        profile?.recordingTimezone ?? "UTC",
      ),
    );
  return days;
}
