import { PrismaClient } from "@prisma/client";
import { db } from "../db";

const systemExercises = [
  {
    id: "system-push-up",
    name: "Push-up",
    description: "A horizontal bodyweight press.",
    equipment: "NONE",
    targetMuscles: ["CHEST", "TRICEPS", "SHOULDERS"],
    movementPattern: "PUSH",
    availableLocations: ["GYM", "HOME"] as const,
  },
  {
    id: "system-bodyweight-squat",
    name: "Bodyweight Squat",
    description: "A bodyweight squat pattern.",
    equipment: "NONE",
    targetMuscles: ["QUADRICEPS", "GLUTES"],
    movementPattern: "SQUAT",
    availableLocations: ["GYM", "HOME"] as const,
  },
  {
    id: "system-plank",
    name: "Plank",
    description: "An isometric trunk stability exercise.",
    equipment: "NONE",
    targetMuscles: ["CORE"],
    movementPattern: "ANTI_EXTENSION",
    availableLocations: ["GYM", "HOME"] as const,
  },
  {
    id: "system-barbell-bench-press",
    name: "Barbell Bench Press",
    description: "A barbell horizontal press performed on a bench.",
    equipment: "BARBELL",
    targetMuscles: ["CHEST", "TRICEPS", "SHOULDERS"],
    movementPattern: "PUSH",
    availableLocations: ["GYM"] as const,
  },
  {
    id: "system-barbell-back-squat",
    name: "Barbell Back Squat",
    description: "A barbell squat pattern.",
    equipment: "BARBELL",
    targetMuscles: ["QUADRICEPS", "GLUTES"],
    movementPattern: "SQUAT",
    availableLocations: ["GYM"] as const,
  },
  {
    id: "system-lat-pulldown",
    name: "Lat Pulldown",
    description: "A cable vertical pull.",
    equipment: "CABLE_MACHINE",
    targetMuscles: ["LATS", "BICEPS"],
    movementPattern: "PULL",
    availableLocations: ["GYM"] as const,
  },
] as const;

export async function seedSystemExercises(
  prisma: PrismaClient = db,
): Promise<void> {
  await Promise.all(
    systemExercises.map((exercise) =>
      prisma.exercise.upsert({
        where: { id: exercise.id },
        update: {
          ownerId: null,
          name: exercise.name,
          description: exercise.description,
          equipment: exercise.equipment,
          targetMuscles: [...exercise.targetMuscles],
          movementPattern: exercise.movementPattern,
          availableLocations: [...exercise.availableLocations],
          aiEligible: true,
        },
        create: {
          id: exercise.id,
          name: exercise.name,
          description: exercise.description,
          equipment: exercise.equipment,
          targetMuscles: [...exercise.targetMuscles],
          movementPattern: exercise.movementPattern,
          availableLocations: [...exercise.availableLocations],
          aiEligible: true,
        },
      }),
    ),
  );
}
