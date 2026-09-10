import { Prisma, PrismaClient } from "@prisma/client";
import {
  customExerciseInputSchema,
  normalizeEquipment,
  type Location,
} from "@fitness/shared";
import type { z } from "zod";

const exerciseSelect = {
  id: true,
  ownerId: true,
  name: true,
  description: true,
  equipment: true,
  targetMuscles: true,
  movementPattern: true,
  availableLocations: true,
  aiEligible: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ExerciseSelect;

export type ExerciseRecord = Prisma.ExerciseGetPayload<{
  select: typeof exerciseSelect;
}>;

export type CustomExerciseInput = z.infer<typeof customExerciseInputSchema>;

export class ExerciseServiceError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "CONFLICT",
    readonly statusCode: 404 | 409,
  ) {
    super(message);
    this.name = "ExerciseServiceError";
  }
}

export class ExerciseService {
  constructor(private readonly prisma: PrismaClient) {}

  async listAvailableExercises(
    userId: string,
    location: Location,
    options: { aiEligibleOnly?: boolean } = {},
  ): Promise<ExerciseRecord[]> {
    return this.prisma.exercise.findMany({
      where: {
        availableLocations: { has: location },
        OR: [{ ownerId: null }, { ownerId: userId }],
        ...(options.aiEligibleOnly ? { aiEligible: true } : {}),
      },
      select: exerciseSelect,
      orderBy: { name: "asc" },
    });
  }

  async getExercise(
    userId: string,
    exerciseId: string,
  ): Promise<ExerciseRecord> {
    const exercise = await this.prisma.exercise.findFirst({
      where: {
        id: exerciseId,
        OR: [{ ownerId: null }, { ownerId: userId }],
      },
      select: exerciseSelect,
    });

    if (!exercise) {
      throw new ExerciseServiceError(
        "Exercise not found",
        "NOT_FOUND",
        404,
      );
    }

    return exercise;
  }

  async createConfirmedCustomExercise(
    userId: string,
    input: CustomExerciseInput,
  ): Promise<ExerciseRecord> {
    const parsed = customExerciseInputSchema.parse(input);

    return this.prisma.exercise.create({
      data: {
        ownerId: userId,
        name: parsed.name,
        description: parsed.description ?? null,
        equipment: normalizeEquipment(parsed.equipment),
        targetMuscles: parsed.targetMuscles,
        movementPattern: parsed.movementPattern ?? null,
        availableLocations: parsed.availableLocations,
        aiEligible: true,
      },
      select: exerciseSelect,
    });
  }
}
