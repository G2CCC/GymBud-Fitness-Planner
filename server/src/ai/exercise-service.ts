import { Prisma, PrismaClient } from "@prisma/client";
import {
  customExerciseInputSchema,
  normalizeEquipment,
  type Location,
} from "@fitness/shared";
import { env } from "../config/env";
import {
  AiClientError,
  type AiClient,
} from "./client";
import {
  exerciseExtractionInputSchema,
  exerciseMetadataDraftSchema,
  replacementResponseSchema,
  type ExerciseMetadataDraft,
  type ReplacementResponse,
} from "./schemas";
import {
  buildExerciseExtractionRequest,
  buildExerciseReplacementRequest,
} from "./prompts/exercise";

const exercisePromptSelect = {
  id: true,
  name: true,
  equipment: true,
  targetMuscles: true,
  movementPattern: true,
  availableLocations: true,
} satisfies Prisma.ExerciseSelect;

const replacementWorkoutSelect = {
  id: true,
  status: true,
  activityType: true,
  location: true,
  cycle: {
    select: {
      id: true,
      userId: true,
      status: true,
      startDate: true,
    },
  },
  plannedExercises: {
    where: {},
    select: {
      exerciseId: true,
    },
  },
} satisfies Prisma.ScheduledWorkoutSelect;

type DatabaseClient = PrismaClient | Prisma.TransactionClient;
type ReplacementWorkout = Prisma.ScheduledWorkoutGetPayload<{
  select: typeof replacementWorkoutSelect;
}>;
type PromptExercise = Prisma.ExerciseGetPayload<{
  select: typeof exercisePromptSelect;
}>;

export type ReplacementOption = ReplacementResponse["replacements"][number] &
  PromptExercise;

export class AiExerciseServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "CONFLICT"
      | "VALIDATION_ERROR"
      | "AI_ERROR",
    readonly statusCode: 400 | 404 | 409 | 502,
  ) {
    super(message);
    this.name = "AiExerciseServiceError";
  }
}

export class AiExerciseService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly aiClient: AiClient,
    private readonly model = env.aiModel,
  ) {}

  async extractExerciseMetadata(input: unknown): Promise<ExerciseMetadataDraft> {
    const parsedInput = exerciseExtractionInputSchema.safeParse(input);
    if (!parsedInput.success) {
      throw validationError(parsedInput.error.message);
    }

    let response: ExerciseMetadataDraft;
    try {
      response = await this.aiClient.generateJson(
        buildExerciseExtractionRequest(parsedInput.data, this.model),
        exerciseMetadataDraftSchema,
      );
    } catch (error) {
      throw mapAiError(error, "AI exercise extraction failed");
    }

    try {
      return customExerciseInputSchema.parse({
        ...response,
        equipment: normalizeEquipment(response.equipment),
      });
    } catch (error) {
      throw validationError(
        error instanceof Error ? error.message : "AI exercise metadata is invalid",
      );
    }
  }

  async getCompatibleReplacements(
    userId: string,
    workoutId: string,
    exerciseId: string,
  ): Promise<ReplacementOption[]> {
    const workout = await this.prisma.scheduledWorkout.findFirst({
      where: { id: workoutId, userId },
      select: replacementWorkoutSelect,
    });

    if (!workout) {
      throw new AiExerciseServiceError(
        "Workout not found",
        "NOT_FOUND",
        404,
      );
    }

    assertReplacementWorkout(workout);
    await assertCurrentCycle(this.prisma, userId, workout);

    if (!workout.plannedExercises.some((exercise) => exercise.exerciseId === exerciseId)) {
      throw validationError("The exercise is not part of this workout");
    }

    const originalExercise = await this.prisma.exercise.findFirst({
      where: {
        id: exerciseId,
        OR: [{ ownerId: null }, { ownerId: userId }],
      },
      select: exercisePromptSelect,
    });

    if (!originalExercise) {
      throw new AiExerciseServiceError(
        "Exercise not found",
        "NOT_FOUND",
        404,
      );
    }

    const candidates = await this.prisma.exercise.findMany({
      where: {
        id: { not: exerciseId },
        aiEligible: true,
        availableLocations: { has: workout.location },
        OR: [{ ownerId: null }, { ownerId: userId }],
      },
      select: exercisePromptSelect,
      orderBy: { name: "asc" },
    });

    let response: ReplacementResponse;
    try {
      response = await this.aiClient.generateJson(
        buildExerciseReplacementRequest(
          {
            location: workout.location,
            originalExercise,
            candidates,
          },
          this.model,
        ),
        replacementResponseSchema,
      );
    } catch (error) {
      throw mapAiError(error, "AI exercise replacement failed");
    }

    const candidateById = new Map(
      candidates.map((candidate) => [candidate.id, candidate]),
    );
    const seen = new Set<string>();
    return response.replacements.map((replacement) => {
      const candidate = candidateById.get(replacement.exerciseId);
      if (!candidate) {
        throw validationError(
          `Replacement exercise ${replacement.exerciseId} is not legal for this workout`,
        );
      }
      if (seen.has(replacement.exerciseId)) {
        throw validationError("Replacement exercises cannot repeat");
      }
      seen.add(replacement.exerciseId);

      return {
        ...replacement,
        ...candidate,
      };
    });
  }
}

function assertReplacementWorkout(workout: ReplacementWorkout): void {
  if (workout.activityType !== "STRENGTH") {
    throw new AiExerciseServiceError(
      "Only strength workouts can receive exercise replacements",
      "CONFLICT",
      409,
    );
  }

  if (workout.status !== "PLANNED") {
    throw new AiExerciseServiceError(
      "Only an unfinished planned workout can receive a replacement",
      "CONFLICT",
      409,
    );
  }
}

async function assertCurrentCycle(
  database: DatabaseClient,
  userId: string,
  workout: ReplacementWorkout,
): Promise<void> {
  if (workout.cycle.userId !== userId) {
    throw new AiExerciseServiceError(
      "The workout cycle does not belong to the current user",
      "NOT_FOUND",
      404,
    );
  }

  if (workout.cycle.status !== "ACTIVE") {
    throw new AiExerciseServiceError(
      "The workout cycle does not accept changes",
      "CONFLICT",
      409,
    );
  }

  const nextCycle = await database.trainingCycle.findFirst({
    where: {
      userId,
      id: { not: workout.cycle.id },
      startDate: { gt: workout.cycle.startDate },
    },
    select: { id: true },
  });

  if (nextCycle) {
    throw new AiExerciseServiceError(
      "The workout cycle is read-only after a newer cycle exists",
      "CONFLICT",
      409,
    );
  }
}

function validationError(message: string): AiExerciseServiceError {
  return new AiExerciseServiceError(message, "VALIDATION_ERROR", 400);
}

function mapAiError(
  error: unknown,
  fallbackMessage: string,
): AiExerciseServiceError {
  if (error instanceof AiExerciseServiceError) {
    return error;
  }

  if (error instanceof AiClientError) {
    return new AiExerciseServiceError(
      error.message,
      "AI_ERROR",
      error.code === "NOT_CONFIGURED" ? 409 : 502,
    );
  }

  return new AiExerciseServiceError(fallbackMessage, "AI_ERROR", 502);
}
