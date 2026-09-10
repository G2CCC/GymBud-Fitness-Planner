import { db } from "../server/src/db";
import { seedDemoUser } from "../server/src/current-user";

async function main() {
  const result = await seedDemoUser();
  console.log(`Seeded demo user: ${result.userId}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
