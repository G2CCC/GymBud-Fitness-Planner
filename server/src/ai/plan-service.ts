import { Prisma, PrismaClient } from "@prisma/client";
import {
  startOfUtcDay,
  type Location,
} from "@fitness/shared";
import { env } from "../config/env";
import {
  AiClientError,
  type AiClient,
} from "./client";
import {
  cardioDetailsSchema,
  planDraftSchema,
  planResponseSchema,
  sportDetailsSchema,
  type PlanDraft,
  type PlanResponse,
} from "./schemas";
import { buildPlanRequest } from "./prompts/plan";

const cycleContextSelect = {
  id: true,
  userId: true,
  status: true,
  startDate: true,
  endDate: true,
  timezone: true,
  user: {
    select: {
      profile: {
        select: {
          primaryGoal: true,
          secondaryOutcome: true,
          weeklyTrainingDays: true,
          sessionDurationMinutes: true,
          defaultLocation: true,
        },
      },
    },
  },
} satisfies Prisma.TrainingCycleSelect;

const legalExerciseSelect = {
  id: true,
  name: true,
  equipment: true,
  targetMuscles: true,
  movementPattern: true,
  availableLocations: true,
} satisfies Prisma.ExerciseSelect;

type DatabaseClient = PrismaClient | Prisma.TransactionClient;
type CycleContext = Prisma.TrainingCycleGetPayload<{
  select: typeof cycleContextSelect;
}>;
type LegalExercise = Prisma.ExerciseGetPayload<{
  select: typeof legalExerciseSelect;
}>;

export type ConfirmedCycle = Prisma.TrainingCycleGetPayload<{
  include: { workouts: true };
}>;

export class PlanServiceError extends Error {
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
    this.name = "PlanServiceError";
  }
}

export class PlanService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly aiClient: AiClient,
    private readonly model = env.aiModel,
  ) {}

  async generateDraft(userId: string, cycleId: string): Promise<PlanDraft> {
    const cycle = await this.getCycleContext(this.prisma, userId, cycleId);
    assertDraftCycle(cycle);

    const profile = requireProfile(cycle);
    const exercises = await this.getLegalExercises(
      this.prisma,
      userId,
      profile.defaultLocation,
    );

    const request = buildPlanRequest({
      cycleId: cycle.id,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      primaryGoal: profile.primaryGoal,
      secondaryOutcome: profile.secondaryOutcome,
      weeklyTrainingDays: profile.weeklyTrainingDays,
      sessionDurationMinutes: profile.sessionDurationMinutes,
      location: profile.defaultLocation,
      exercises: exercises.map(toPromptExercise),
      model: this.model,
    });

    let response: PlanResponse;
    try {
      response = await this.aiClient.generateJson(
        request,
        planResponseSchema,
      );
    } catch (error) {
      throw mapAiError(error);
    }

    return this.buildDraft(
      cycle,
      response,
      exercises,
      request.model,
      request.promptVersion,
      true,
    );
  }

  async confirmDraft(
    userId: string,
    cycleId: string,
    input: unknown,
  ): Promise<ConfirmedCycle> {
    const parsed = planDraftSchema.safeParse(input);
    if (!parsed.success) {
      throw validationError(parsed.error.message);
    }

    if (parsed.data.cycleId !== cycleId) {
      throw validationError("The draft does not belong to this cycle");
    }

    const response = toPlanResponse(parsed.data);

    return this.prisma.$transaction(async (tx) => {
      const cycle = await this.getCycleContext(tx, userId, cycleId);
      assertDraftCycle(cycle);

      const exercises = await this.getLegalExercises(tx, userId);
      this.buildDraft(
        cycle,
        response,
        exercises,
        parsed.data.model,
        parsed.data.promptVersion,
        false,
      );

      for (const workout of response.workouts) {
        await tx.scheduledWorkout.create({
          data: {
            userId,
            cycleId,
            activityType: workout.activityType,
            scheduledDate: workout.scheduledDate,
            location: workout.location,
            durationMinutes: workout.durationMinutes,
            source: "ORIGINAL",
            status: "PLANNED",
            ...(workout.plannedDetails
              ? {
                  plannedDetails: workout.plannedDetails as Prisma.InputJsonValue,
                }
              : {}),
            ...(workout.activityType === "STRENGTH"
              ? {
                  plannedExercises: {
                    create: workout.exercises.map((exercise) => ({
                      exerciseId: exercise.exerciseId,
                      sortOrder: exercise.sortOrder,
                      restSeconds: exercise.restSeconds ?? null,
                      plannedSets: {
                        create: exercise.sets.map((set) => ({
                          setNumber: set.setNumber,
                          targetReps: set.targetReps,
                          plannedWeight: set.plannedWeight ?? null,
                          weightUnit: set.weightUnit ?? null,
                        })),
                      },
                    })),
                  },
                }
              : {}),
          },
        });
      }

      return tx.trainingCycle.update({
        where: { id: cycleId },
        data: { status: "ACTIVE" },
        include: { workouts: true },
      });
    });
  }

  private async getCycleContext(
    database: DatabaseClient,
    userId: string,
    cycleId: string,
  ): Promise<CycleContext> {
    const cycle = await database.trainingCycle.findFirst({
      where: { id: cycleId, userId },
      select: cycleContextSelect,
    });

    if (!cycle) {
      throw new PlanServiceError(
        "Training cycle not found",
        "NOT_FOUND",
        404,
      );
    }

    return cycle;
  }

  private async getLegalExercises(
    database: DatabaseClient,
    userId: string,
    location?: Location,
  ): Promise<LegalExercise[]> {
    return database.exercise.findMany({
      where: {
        aiEligible: true,
        OR: [{ ownerId: null }, { ownerId: userId }],
        ...(location ? { availableLocations: { has: location } } : {}),
      },
      select: legalExerciseSelect,
      orderBy: { name: "asc" },
    });
  }

  private buildDraft(
    cycle: CycleContext,
    response: PlanResponse,
    exercises: LegalExercise[],
    model: string,
    promptVersion: string,
    requireDefaultLocation: boolean,
  ): PlanDraft {
    requireProfile(cycle);
    const exerciseById = new Map(
      exercises.map((exercise) => [exercise.id, exercise]),
    );

    for (const workout of response.workouts) {
      validateWorkoutDate(workout.scheduledDate, cycle);

      if (requireDefaultLocation && workout.location !== profileLocation(cycle)) {
        throw validationError(
          "Generated workouts must use the user's default location",
        );
      }

      if (workout.activityType === "STRENGTH") {
        if (workout.exercises.length === 0) {
          throw validationError(
            "A strength workout must contain at least one exercise",
          );
        }

        validateUniqueNumbers(
          workout.exercises.map((exercise) => exercise.sortOrder),
          "exercise sortOrder",
        );

        for (const exercise of workout.exercises) {
          const legalExercise = exerciseById.get(exercise.exerciseId);
          if (
            !legalExercise ||
            !legalExercise.availableLocations.includes(workout.location)
          ) {
            throw validationError(
              `Exercise ${exercise.exerciseId} is not legal for this user and location`,
            );
          }

          validateUniqueNumbers(
            exercise.sets.map((set) => set.setNumber),
            "setNumber",
          );
        }
      } else if (workout.exercises.length > 0) {
        throw validationError(
          `${workout.activityType} workouts cannot contain strength exercises`,
        );
      }

      validateActivityDetails(workout);
    }

    return planDraftSchema.parse({
      cycleId: cycle.id,
      model,
      promptVersion,
      workouts: response.workouts.map((workout) => ({
        ...workout,
        exercises: workout.exercises.map((exercise) => {
          const legalExercise = exerciseById.get(exercise.exerciseId);
          if (!legalExercise) {
            throw validationError(
              `Exercise ${exercise.exerciseId} is not legal for this user`,
            );
          }

          return {
            ...exercise,
            name: legalExercise.name,
            equipment: legalExercise.equipment,
            availableLocations: legalExercise.availableLocations,
          };
        }),
      })),
    });
  }
}

function assertDraftCycle(cycle: CycleContext): void {
  if (cycle.status !== "DRAFT") {
    throw new PlanServiceError(
      "Only a draft cycle can receive an AI plan",
      "CONFLICT",
      409,
    );
  }
}

function requireProfile(cycle: CycleContext) {
  if (!cycle.user.profile) {
    throw new PlanServiceError(
      "The user profile is required before generating a plan",
      "CONFLICT",
      409,
    );
  }

  return cycle.user.profile;
}

function profileLocation(cycle: CycleContext): Location {
  return requireProfile(cycle).defaultLocation;
}

function validateWorkoutDate(date: Date, cycle: CycleContext): void {
  const value = startOfUtcDay(date).getTime();
  const start = startOfUtcDay(cycle.startDate).getTime();
  const end = startOfUtcDay(cycle.endDate).getTime();

  if (value < start || value > end) {
    throw validationError("A planned workout date must be inside the cycle");
  }
}

function validateUniqueNumbers(values: number[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw validationError(`${label} values must be unique`);
  }
}

function validateActivityDetails(
  workout: PlanResponse["workouts"][number],
): void {
  if (!workout.plannedDetails) {
    if (workout.activityType !== "STRENGTH") {
      throw validationError(
        `${workout.activityType} workouts require planned activity details`,
      );
    }
    return;
  }

  const schema =
    workout.activityType === "CARDIO"
      ? cardioDetailsSchema
      : workout.activityType === "SPORT"
        ? sportDetailsSchema
        : null;

  if (schema && !schema.safeParse(workout.plannedDetails).success) {
    throw validationError(
      `${workout.activityType} planned details are invalid`,
    );
  }
}

function toPromptExercise(exercise: LegalExercise) {
  return {
    id: exercise.id,
    name: exercise.name,
    equipment: exercise.equipment,
    targetMuscles: exercise.targetMuscles,
    movementPattern: exercise.movementPattern,
    availableLocations: exercise.availableLocations,
  };
}

function toPlanResponse(draft: PlanDraft): PlanResponse {
  return planResponseSchema.parse({
    workouts: draft.workouts.map((workout) => ({
      scheduledDate: workout.scheduledDate,
      activityType: workout.activityType,
      location: workout.location,
      durationMinutes: workout.durationMinutes,
      plannedDetails: workout.plannedDetails,
      exercises: workout.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        sortOrder: exercise.sortOrder,
        restSeconds: exercise.restSeconds,
        sets: exercise.sets,
      })),
    })),
  });
}

function validationError(message: string): PlanServiceError {
  return new PlanServiceError(message, "VALIDATION_ERROR", 400);
}

function mapAiError(error: unknown): PlanServiceError {
  if (error instanceof AiClientError) {
    return new PlanServiceError(
      error.message,
      "AI_ERROR",
      error.code === "NOT_CONFIGURED" ? 409 : 502,
    );
  }

  return new PlanServiceError(
    "AI plan generation failed",
    "AI_ERROR",
    502,
  );
}
