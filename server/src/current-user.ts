import type { Request } from "express";
import { db } from "./db";
import { ProfileService } from "./profiles/service";
import { getRequestAuth } from "./auth/types";

const demoProfile = {
  primaryGoal: "FAT_LOSS" as const,
  weeklyTrainingDays: 3,
  sessionDurationMinutes: 60,
  sex: "MALE" as const,
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

  await new ProfileService(db).saveProfile(user.id, { ...demoProfile, recordingTimezone: "UTC" });

  return { userId: user.id };
}

export function getAuthenticatedUserId(request: Request): string {
  return getRequestAuth(request).userId;
}
