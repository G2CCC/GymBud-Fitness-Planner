import type { Prisma } from "@prisma/client";
import {
  localDateSchema,
  nutritionLocalDate,
  NutritionError,
} from "@fitness/shared";

export async function nutritionDateContext(
  tx: Prisma.TransactionClient,
  userId: string,
  date: string,
  now: Date,
) {
  localDateSchema.parse(date);
  const [profile, day] = await Promise.all([
    tx.userProfile.findUnique({ where: { userId } }),
    tx.nutritionDay.findUnique({
      where: { userId_localDate: { userId, localDate: date } },
    }),
  ]);
  if (!profile?.nutritionStartedOn)
    throw new NutritionError("Save your profile before recording nutrition");
  const timezone = day?.timezone ?? profile.recordingTimezone;
  if (
    date < profile.nutritionStartedOn ||
    date > nutritionLocalDate(now, timezone)
  )
    throw new NutritionError(
      "Choose a date between your nutrition start date and today",
    );
  return { profile, day, timezone };
}

export async function ensureNutritionDay(
  tx: Prisma.TransactionClient,
  userId: string,
  date: string,
  timezone: string,
) {
  return tx.nutritionDay.upsert({
    where: { userId_localDate: { userId, localDate: date } },
    create: { userId, localDate: date, timezone },
    update: {},
  });
}
