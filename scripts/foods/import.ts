import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";
import type { NormalizedFood } from "./transform";
import { loadFoodSource } from "./source";
export async function importFoods(
  db: PrismaClient,
  rows: NormalizedFood[],
  release: string,
) {
  if (!rows.length || new Set(rows.map((r) => r.sourceId)).size !== rows.length)
    throw Error("Import requires a nonempty, unique, validated selection");
  for (const row of rows)
    if (
      !Object.values(row.per100g).every(
        (n) => Number.isFinite(n) && n >= 0 && n < 1e10,
      )
    )
      throw Error("Invalid nutrient value");
  return db.$transaction(
    async (tx) => {
      let created = 0,
        updated = 0;
      for (const row of rows) {
        const source = {
          sourceProvider: "USDA_SR_LEGACY",
          sourceRelease: release,
          sourceId: row.sourceId,
        };
        const key = { sourceProvider_sourceRelease_sourceId: source };
        const exists = await tx.food.findUnique({
          where: key,
          select: { id: true },
        });
        const values = {
          name: row.name,
          active: true,
          kcalPer100g: row.per100g.kcal,
          proteinPer100g: row.per100g.proteinG,
          carbsPer100g: row.per100g.carbsG,
          fatPer100g: row.per100g.fatG,
        };
        const food = await tx.food.upsert({
          where: key,
          create: { ...source, ...values },
          update: values,
        });
        exists ? updated++ : created++;
        for (const portion of row.portions)
          await tx.foodPortion.upsert({
            where: {
              foodId_sourcePortionId: {
                foodId: food.id,
                sourcePortionId: portion.sourcePortionId,
              },
            },
            create: { foodId: food.id, ...portion, active: true },
            update: { ...portion, active: true },
          });
        await tx.foodPortion.updateMany({
          where: {
            foodId: food.id,
            sourcePortionId: {
              notIn: row.portions.map((p) => p.sourcePortionId),
            },
          },
          data: { active: false },
        });
      }
      await tx.food.updateMany({
        where: {
          sourceProvider: "USDA_SR_LEGACY",
          sourceRelease: release,
          sourceId: { notIn: rows.map((r) => r.sourceId) },
        },
        data: { active: false },
      });
      return { created, updated, active: rows.length };
    },
    { timeout: 120000, maxWait: 10000 },
  );
}
async function main() {
  const args = process.argv.slice(2);
  const input = args[args.indexOf("--input") + 1],
    release = args[args.indexOf("--release") + 1];
  if (!args.includes("--input") || !args.includes("--release"))
    throw Error(
      "Usage: foods:import --input <extracted JSON> --release 2018-04",
    );
  const { rows, report } = await loadFoodSource(input, release);
  const db = new PrismaClient();
  try {
    console.log(
      JSON.stringify(
        { ...report, ...(await importFoods(db, rows, release)) },
        null,
        2,
      ),
    );
  } finally {
    await db.$disconnect();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
