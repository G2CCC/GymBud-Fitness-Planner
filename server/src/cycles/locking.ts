import type { Prisma } from "@prisma/client";

/** Serialize training mutations and review freezing before reading their inputs.
 * A write (rather than only FOR UPDATE) also makes a waiting RepeatableRead
 * review retry with a fresh snapshot when a training mutation committed first.
 */
export async function serializeCycleWrite(
  tx: Prisma.TransactionClient,
  userId: string,
  cycleId: string,
): Promise<void> {
  await tx.trainingCycle.updateMany({
    where: { id: cycleId, userId },
    data: { updatedAt: new Date() },
  });
}
