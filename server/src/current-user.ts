import type { Request } from "express";
import { db } from "./db";
import { getRequestAuth } from "./auth/types";

const demoProfile = {
  primaryGoal: "FAT_LOSS",
  secondaryOutcome: "MUSCLE_PRESERVATION",
  weeklyTrainingDays: 3,
  sessionDurationMinutes: 60,
  defaultLocation: "GYM" as const,
  gender: "MALE" as const,
  age: 27,
  heightCm: 178,
  weightKg: 82,
};

export async function seedTestUser(userId: string): Promise<{ userId: string }> {
  const providerUserId = `test:${userId}`;
  const email = `${userId}@example.test`;
  const user = await db.user.upsert({
    where: { id: userId },
    update: { email, authUserId: providerUserId },
    create: {
      id: userId,
      email,
      authUserId: providerUserId,
    },
  });

  await db.userProfile.upsert({
    where: { userId: user.id },
    update: demoProfile,
    create: {
      userId: user.id,
      ...demoProfile,
    },
  });

  return { userId: user.id };
}

export function getAuthenticatedUserId(request: Request): string {
  return getRequestAuth(request).userId;
}
