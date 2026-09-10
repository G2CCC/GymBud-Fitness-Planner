import { db } from "../server/src/db";
import { seedDemoUser } from "../server/src/current-user";
import { seedSystemExercises } from "../server/src/exercises/seed";

async function main() {
  const result = await seedDemoUser();
  await seedSystemExercises();
  console.log(`Seeded demo user: ${result.userId} and system exercises`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
