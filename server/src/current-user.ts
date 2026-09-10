import { env } from "./config/env";
import { db } from "./db";

const demoUserEmail = "demo@example.com";

const demoProfile = {
  primaryGoal: "FAT_LOSS",
  secondaryOutcome: "MUSCLE_PRESERVATION",
  weeklyTrainingDays: 3,
  sessionDurationMinutes: 60,
  defaultLocation: "GYM" as const,
};

export async function seedDemoUser(): Promise<{ userId: string }> {
  const user = await db.user.upsert({
    where: { id: env.demoUserId },
    update: { email: demoUserEmail },
    create: {
      id: env.demoUserId,
      email: demoUserEmail,
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

export async function getCurrentUserId(): Promise<string> {
  const user = await db.user.findUnique({
    where: { id: env.demoUserId },
    select: { id: true },
  });

  if (!user) {
    throw new Error("Demo user is not seeded. Run the database seed first.");
  }

  return user.id;
}
