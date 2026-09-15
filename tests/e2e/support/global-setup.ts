import type { FullConfig } from "@playwright/test";

export default async function globalSetup(_config: FullConfig) {
  if (!process.env.DATABASE_URL) {
    return;
  }

  const { db } = await import("../../../server/src/db");
  const { seedDemoUser } = await import("../../../server/src/current-user");
  const { seedSystemExercises } = await import(
    "../../../server/src/exercises/seed"
  );

  await seedDemoUser();
  await seedSystemExercises(db);
  await resetDatabase(db);

  return async () => {
    await resetDatabase(db);
    await db.user.deleteMany({
      where: { id: process.env.DEMO_USER_ID ?? "e2e-demo-user" },
    });
    await db.$disconnect();
  };
}

async function resetDatabase(database: {
  cycleBatchReview: { deleteMany: (args: { where: { userId: string } }) => Promise<unknown> };
  scheduledWorkout: { deleteMany: (args: { where: { userId: string } }) => Promise<unknown> };
  trainingCycle: { deleteMany: (args: { where: { userId: string } }) => Promise<unknown> };
}) {
  const userId = process.env.DEMO_USER_ID ?? "e2e-demo-user";
  await database.cycleBatchReview.deleteMany({ where: { userId } });
  await database.scheduledWorkout.deleteMany({ where: { userId } });
  await database.trainingCycle.deleteMany({ where: { userId } });
}
