import { PrismaClient } from "@prisma/client";
import {
  profileInputSchema,
  calculateNutritionTarget,
  nutritionLocalDate,
  NutritionError,
  type ProfileInput,
} from "@fitness/shared";
export const profileSelect = {
  weeklyTrainingDays: true,
  sessionDurationMinutes: true,
  primaryGoal: true,
  sex: true,
  age: true,
  heightCm: true,
  weightKg: true,
  recordingTimezone: true,
} as const;
export class ProfileService {
  constructor(private readonly prisma: PrismaClient) {}
  async saveProfile(
    userId: string,
    input: ProfileInput,
    now = new Date(),
  ): Promise<ProfileInput> {
    const parsed = profileInputSchema.safeParse(input);
    if (!parsed.success)
      throw new NutritionError(
        parsed.error.issues[0]?.message ?? "Check your profile",
      );
    const value = parsed.data;
    const target = calculateNutritionTarget(value);
    return this.prisma.$transaction(async (tx) => {
      // The owner exists even before the first profile. Read previous values only
      // after competing saves have committed, so profile and target stay paired.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const previous = await tx.userProfile.findUnique({ where: { userId } });
      const timezone = value.recordingTimezone ?? previous?.recordingTimezone;
      if (!timezone)
        throw new NutritionError(
          "Provide a recording timezone with your first profile",
        );
      const today = nutritionLocalDate(now, timezone);
      const latest = await tx.nutritionTarget.findFirst({
        where: { userId },
        orderBy: { effectiveDate: "desc" },
      });
      // A day retains its original timezone after travel, including when the
      // timezone was saved separately before the body-data edit.
      const days = await tx.nutritionDay.findMany({
        where: { userId, localDate: { gte: today } },
        select: { localDate: true, timezone: true },
      });
      const protectedBoundaries = days
        .filter((day) => day.localDate < nutritionLocalDate(now, day.timezone))
        .map((day) => {
          const next = new Date(`${day.localDate}T00:00:00Z`);
          next.setUTCDate(next.getUTCDate() + 1);
          return next.toISOString().slice(0, 10);
        });
      const effectiveDate = [
        today,
        previous ? nutritionLocalDate(now, previous.recordingTimezone) : today,
        latest?.effectiveDate ?? today,
        ...protectedBoundaries,
      ]
        .sort()
        .at(-1)!;
      const changed =
        !latest ||
        !previous ||
        (["sex", "age", "heightCm", "weightKg", "primaryGoal"] as const).some(
          (key) => previous[key] !== value[key],
        );
      const result = await tx.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          ...value,
          recordingTimezone: timezone,
          nutritionStartedOn: today,
        },
        update: {
          ...value,
          recordingTimezone: timezone,
          nutritionStartedOn: previous?.nutritionStartedOn ?? today,
        },
        select: profileSelect,
      });
      if (changed) {
        const data = {
          ...target,
          profileSnapshot: {
            sex: value.sex,
            age: value.age,
            heightCm: value.heightCm,
            weightKg: value.weightKg,
            primaryGoal: value.primaryGoal,
          },
        };
        await tx.nutritionTarget.upsert({
          where: { userId_effectiveDate: { userId, effectiveDate } },
          create: { userId, effectiveDate, ...data },
          update: data,
        });
      }
      return result;
    });
  }
}
