import type { Prisma } from "@prisma/client";
import type { TargetValues } from "@fitness/shared";
export async function getTargetForDate(
  tx: Prisma.TransactionClient,
  userId: string,
  date: string,
): Promise<TargetValues | null> {
  const row = await tx.nutritionTarget.findFirst({
    where: { userId, effectiveDate: { lte: date } },
    orderBy: { effectiveDate: "desc" },
  });
  return row
    ? {
        kcal: row.kcal,
        proteinG: Number(row.proteinG),
        carbsG: Number(row.carbsG),
        fatG: Number(row.fatG),
        algorithmVersion:
          row.algorithmVersion as TargetValues["algorithmVersion"],
      }
    : null;
}
