import { db } from "../server/src/db";
import { seedSystemExercises } from "../server/src/exercises/seed";

async function main() {
  await seedSystemExercises();
  console.log("Seeded system exercises");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
