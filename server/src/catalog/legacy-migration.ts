import { PrismaClient } from "@prisma/client";

const legacyExerciseMappings = [
  ["system-push-up", "free-exercise-db-Pushups"],
  ["system-bodyweight-squat", "free-exercise-db-Bodyweight_Squat"],
  ["system-plank", "free-exercise-db-Plank"],
  ["system-barbell-bench-press", "free-exercise-db-Barbell_Bench_Press_-_Medium_Grip"],
  ["system-barbell-back-squat", "free-exercise-db-Barbell_Squat"],
  ["system-lat-pulldown", "free-exercise-db-Full_Range-Of-Motion_Lat_Pulldown"],
] as const;

export async function migrateLegacySystemExercises(
  prisma: PrismaClient,
): Promise<{ migratedReferences: number; deletedExercises: number }> {
  return prisma.$transaction(async (tx) => {
    let migratedReferences = 0;
    let deletedExercises = 0;

    for (const [legacyId, canonicalId] of legacyExerciseMappings) {
      const legacyExercise = await tx.exercise.findUnique({
        where: { id: legacyId },
        select: { ownerId: true },
      });

      if (!legacyExercise || legacyExercise.ownerId !== null) {
        continue;
      }

      const canonicalExercise = await tx.exercise.findUnique({
        where: { id: canonicalId },
        select: { id: true },
      });
      if (!canonicalExercise) {
        throw new Error(
          `Cannot migrate ${legacyId}: canonical exercise ${canonicalId} does not exist`,
        );
      }

      const planned = await tx.plannedExercise.updateMany({
        where: { exerciseId: legacyId },
        data: { exerciseId: canonicalId },
      });
      const logged = await tx.exerciseLog.updateMany({
        where: { exerciseId: legacyId },
        data: { exerciseId: canonicalId },
      });
      const recommendations = await tx.aIRecommendation.updateMany({
        where: { exerciseId: legacyId },
        data: { exerciseId: canonicalId },
      });
      migratedReferences += planned.count + logged.count + recommendations.count;

      const [remainingPlanned, remainingLogs, remainingRecommendations] = await Promise.all([
        tx.plannedExercise.count({ where: { exerciseId: legacyId } }),
        tx.exerciseLog.count({ where: { exerciseId: legacyId } }),
        tx.aIRecommendation.count({ where: { exerciseId: legacyId } }),
      ]);
      if (remainingPlanned || remainingLogs || remainingRecommendations) {
        throw new Error(`Cannot delete ${legacyId}: historical references remain`);
      }

      const deleted = await tx.exercise.deleteMany({
        where: { id: legacyId, ownerId: null },
      });
      deletedExercises += deleted.count;
    }

    return { migratedReferences, deletedExercises };
  });
}

export { legacyExerciseMappings };
