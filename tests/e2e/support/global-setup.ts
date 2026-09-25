import type { FullConfig } from "@playwright/test";

export default async function globalSetup(_config: FullConfig) {
  if (!process.env.DATABASE_URL) {
    return;
  }

  const { db } = await import("../../../server/src/db");
  const { seedTestUser } = await import("../../../server/src/current-user");
  const { seedCatalog } = await import("../../../server/src/catalog/seed");

  const userId = process.env.E2E_USER_ID ?? "e2e-demo-user";
  await seedTestUser(userId);
  await seedCatalog(db);
  await resetDatabase(db);

  return async () => {
    await resetDatabase(db);
    await db.user.deleteMany({
      where: { id: userId },
    });
    await db.$disconnect();
  };
}

async function resetDatabase(database: {
  scheduledWorkout: { deleteMany: (args: { where: { userId: string } }) => Promise<unknown> };
  trainingCycle: { deleteMany: (args: { where: { userId: string } }) => Promise<unknown> };
}) {
  const userId = process.env.E2E_USER_ID ?? "e2e-demo-user";
  await database.scheduledWorkout.deleteMany({ where: { userId } });
  await database.trainingCycle.deleteMany({ where: { userId } });
}
