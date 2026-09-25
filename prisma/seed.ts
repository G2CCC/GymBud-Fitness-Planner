import { db } from "../server/src/db";
import { migrateLegacySystemExercises } from "../server/src/catalog/legacy-migration";
import { seedCatalog } from "../server/src/catalog/seed";

async function main() {
  await seedCatalog(db);
  await migrateLegacySystemExercises(db);
  console.log("Seeded catalog and migrated legacy system exercises");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
