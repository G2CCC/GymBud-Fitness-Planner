import { PrismaClient } from "@prisma/client";
import { selectedStrengthExercises } from "./data/strength-exercises";
import { activityOptions } from "./activity-options";

export async function seedCatalog(
  prisma: PrismaClient,
): Promise<{ strengthCount: number; activityOptionCount: number }> {
  for (const exercise of selectedStrengthExercises) {
    await prisma.exercise.upsert({
      where: { id: exercise.id },
      update: {
        ownerId: null,
        name: exercise.name,
        description: exercise.description,
        equipment: exercise.equipment,
        targetMuscles: [...exercise.targetMuscles],
        movementPattern: exercise.movementPattern,
        sourceProvider: exercise.sourceProvider,
        sourceId: exercise.sourceId,
        sourceCommit: exercise.sourceCommit,
        sourceCategory: exercise.sourceCategory,
        level: exercise.level,
        primaryMuscles: [...exercise.primaryMuscles],
        secondaryMuscles: [...exercise.secondaryMuscles],
        focusAreas: [...exercise.focusAreas],
        instructions: [...exercise.instructions],
        imagePaths: [...exercise.imagePaths],
        aiEligible: exercise.aiEligible,
      },
      create: {
        id: exercise.id,
        ownerId: null,
        name: exercise.name,
        description: exercise.description,
        equipment: exercise.equipment,
        targetMuscles: [...exercise.targetMuscles],
        movementPattern: exercise.movementPattern,
        sourceProvider: exercise.sourceProvider,
        sourceId: exercise.sourceId,
        sourceCommit: exercise.sourceCommit,
        sourceCategory: exercise.sourceCategory,
        level: exercise.level,
        primaryMuscles: [...exercise.primaryMuscles],
        secondaryMuscles: [...exercise.secondaryMuscles],
        focusAreas: [...exercise.focusAreas],
        instructions: [...exercise.instructions],
        imagePaths: [...exercise.imagePaths],
        aiEligible: exercise.aiEligible,
      },
    });
  }

  for (const activity of activityOptions) {
    await prisma.activityOption.upsert({
      where: { id: activity.id },
      update: {
        activityType: activity.activityType,
        slug: activity.slug,
        name: activity.name,
        iconKey: activity.iconKey,
        aiEligible: activity.aiEligible,
        sortOrder: activity.sortOrder,
        description: activity.description,
      },
      create: {
        id: activity.id,
        activityType: activity.activityType,
        slug: activity.slug,
        name: activity.name,
        iconKey: activity.iconKey,
        aiEligible: activity.aiEligible,
        sortOrder: activity.sortOrder,
        description: activity.description,
      },
    });
  }

  return {
    strengthCount: selectedStrengthExercises.length,
    activityOptionCount: activityOptions.length,
  };
}
