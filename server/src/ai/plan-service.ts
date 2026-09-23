import { Prisma, PrismaClient } from "@prisma/client";
import {
  addUtcDays,
  startOfLocalDate,
  startOfUtcDay,
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
  singleDayPlanInputSchema,
  singleDayPlanResponseSchema,
  sportDetailsSchema,
  type PlanDraft,
  type PlanResponse,
} from "./schemas";
import { buildSingleDayPlanRequest } from "./prompts/day-plan";
import { buildPlanRequest } from "./prompts/plan";
import type {
  CycleTrainingVolume,
} from "@fitness/shared/domain/reviews/cycle-volume";

const cycleContextSelect = {
  id: true,
  userId: true,
  status: true,
  cycleNumber: true,
  startDate: true,
  endDate: true,
  timezone: true,
  user: {
    select: {
      profile: {
        select: {
          primaryGoal: true,
          weeklyTrainingDays: true,
          sessionDurationMinutes: true,
          gender: true,
          age: true,
          heightCm: true,
          weightKg: true,
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
} satisfies Prisma.ExerciseSelect;

const confirmedWorkoutSelect = {
  id: true,
  activityType: true,
  scheduledDate: true,
  durationMinutes: true,
  status: true,
  completedAt: true,
  rescheduleCount: true,
  plannedDetails: true,
  plannedExercises: {
    orderBy: { sortOrder: "asc" },
    select: {
      exerciseId: true,
      sortOrder: true,
      restSeconds: true,
      plannedSets: {
        orderBy: { setNumber: "asc" },
        select: {
          setNumber: true,
          targetReps: true,
          plannedWeight: true,
          weightUnit: true,
        },
      },
    },
  },
} satisfies Prisma.ScheduledWorkoutSelect;

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

export type ConfirmedWorkout = Prisma.ScheduledWorkoutGetPayload<{
  select: typeof confirmedWorkoutSelect;
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

  async generateDraft(
    userId: string,
    cycleId: string,
    options: {
      reviewContext?: {
        processedSummary: string | null;
        conclusions: unknown;
        trainingVolume: CycleTrainingVolume;
      };
    } = {},
  ): Promise<PlanDraft> {
    const cycle = await this.getCycleContext(this.prisma, userId, cycleId);
    assertDraftCycle(cycle);

    const profile = requireProfile(cycle);
    const exercises = await this.getLegalExercises(this.prisma, userId);

    const request = buildPlanRequest({
      cycleId: cycle.id,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      primaryGoal: profile.primaryGoal,
      weeklyTrainingDays: profile.weeklyTrainingDays,
      sessionDurationMinutes: profile.sessionDurationMinutes,
      gender: profile.gender,
      age: profile.age,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      exercises: exercises.map(toPromptExercise),
      reviewContext: options.reviewContext,
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
      );

      for (const workout of response.workouts) {
        await tx.scheduledWorkout.create({
          data: {
            userId,
            cycleId,
            activityType: workout.activityType,
            scheduledDate: workout.scheduledDate,
            durationMinutes: workout.durationMinutes,
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

      const highestCycle = await tx.trainingCycle.aggregate({
        where: { userId, cycleNumber: { not: null } },
        _max: { cycleNumber: true },
      });
      const cycleNumber =
        cycle.cycleNumber ?? (highestCycle._max.cycleNumber ?? 0) + 1;

      return tx.trainingCycle.update({
        where: { id: cycleId },
        data: { status: "ACTIVE", cycleNumber },
        include: { workouts: true },
      });
    });
  }

  async generateSingleDayDraft(
    userId: string,
    cycleId: string,
    input: unknown,
    now = new Date(),
  ): Promise<PlanDraft> {
    const parsed = singleDayPlanInputSchema.safeParse(input);
    if (!parsed.success) {
      throw validationError(parsed.error.message);
    }

    const cycle = await this.getCycleContext(this.prisma, userId, cycleId);
    assertActiveCycle(cycle);
    const scheduledDate = validateSingleDayDate(cycle, parsed.data.scheduledDate, now);
    await assertTargetDateIsEmpty(this.prisma, userId, cycleId, scheduledDate);

    const profile = requireProfile(cycle);
    const exercises = await this.getLegalExercises(this.prisma, userId);
    const request = buildSingleDayPlanRequest({
      cycleId: cycle.id,
      scheduledDate,
      focusAreas: parsed.data.focusAreas,
      primaryGoal: profile.primaryGoal,
      sessionDurationMinutes: profile.sessionDurationMinutes,
      gender: profile.gender,
      age: profile.age,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      exercises: exercises.map(toPromptExercise),
      model: this.model,
    });

    let response: { workout: PlanResponse["workouts"][number] };
    try {
      response = await this.aiClient.generateJson(
        request,
        singleDayPlanResponseSchema,
      );
    } catch (error) {
      throw mapAiError(error);
    }

    const draft = this.buildDraft(
      cycle,
      { workouts: [response.workout] },
      exercises,
      request.model,
      request.promptVersion,
    );
    assertSingleDayPlan(draft, scheduledDate);
    return draft;
  }

  async confirmSingleDayDraft(
    userId: string,
    cycleId: string,
    input: unknown,
    now = new Date(),
  ): Promise<ConfirmedWorkout> {
    const parsed = planDraftSchema.safeParse(input);
    if (!parsed.success) {
      throw validationError(parsed.error.message);
    }

    if (parsed.data.cycleId !== cycleId) {
      throw validationError("The draft does not belong to this cycle");
    }

    const response = toPlanResponse(parsed.data);
    const scheduledDate = response.workouts[0]
      ? startOfUtcDay(response.workouts[0].scheduledDate)
      : null;
    if (!scheduledDate) {
      throw validationError("A single-day draft must contain one workout");
    }

    return this.prisma.$transaction(async (tx) => {
      const cycle = await this.getCycleContext(tx, userId, cycleId);
      assertActiveCycle(cycle);
      const validScheduledDate = validateSingleDayDate(
        cycle,
        scheduledDate,
        now,
      );
      await assertTargetDateIsEmpty(tx, userId, cycleId, validScheduledDate);

      const exercises = await this.getLegalExercises(tx, userId);
      const draft = this.buildDraft(
        cycle,
        response,
        exercises,
        parsed.data.model,
        parsed.data.promptVersion,
      );
      assertSingleDayPlan(draft, validScheduledDate);
      const workout = draft.workouts[0]!;

      return tx.scheduledWorkout.create({
        data: {
          userId,
          cycleId,
          activityType: "STRENGTH",
          scheduledDate: workout.scheduledDate,
          durationMinutes: workout.durationMinutes,
          status: "PLANNED",
          ...(workout.plannedDetails
            ? {
                plannedDetails: workout.plannedDetails as Prisma.InputJsonValue,
              }
            : {}),
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
        },
        select: confirmedWorkoutSelect,
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
  ): Promise<LegalExercise[]> {
    return database.exercise.findMany({
      where: {
        aiEligible: true,
        OR: [{ ownerId: null }, { ownerId: userId }],
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
  ): PlanDraft {
    requireProfile(cycle);
    const exerciseById = new Map(
      exercises.map((exercise) => [exercise.id, exercise]),
    );

    for (const workout of response.workouts) {
      validateWorkoutDate(workout.scheduledDate, cycle);

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
          if (!legalExercise) {
            throw validationError(
              `Exercise ${exercise.exerciseId} is not legal for this user`,
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

function assertActiveCycle(cycle: CycleContext): void {
  if (cycle.status !== "ACTIVE") {
    throw new PlanServiceError(
      "Only an active cycle can receive a single-day AI plan",
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

function validateWorkoutDate(date: Date, cycle: CycleContext): void {
  const value = startOfUtcDay(date).getTime();
  const start = startOfUtcDay(cycle.startDate).getTime();
  const end = startOfUtcDay(cycle.endDate).getTime();

  if (value < start || value > end) {
    throw validationError("A planned workout date must be inside the cycle");
  }
}

function validateSingleDayDate(
  cycle: CycleContext,
  date: Date,
  now: Date,
): Date {
  const timezone = cycle.timezone;
  if (!timezone) {
    throw new PlanServiceError(
      "The active cycle has no timezone snapshot",
      "CONFLICT",
      409,
    );
  }

  const scheduledDate = startOfUtcDay(date);
  const today = startOfLocalDate(now, timezone);
  const cycleEnd = startOfUtcDay(cycle.endDate);

  if (scheduledDate.getTime() < today.getTime()) {
    throw validationError("A single-day plan must be scheduled today or later");
  }

  if (scheduledDate.getTime() > cycleEnd.getTime()) {
    throw validationError("A single-day plan must be inside the active cycle");
  }

  return scheduledDate;
}

async function assertTargetDateIsEmpty(
  database: DatabaseClient,
  userId: string,
  cycleId: string,
  scheduledDate: Date,
): Promise<void> {
  const existing = await database.scheduledWorkout.findFirst({
    where: {
      userId,
      cycleId,
      scheduledDate: {
        gte: scheduledDate,
        lt: addUtcDays(scheduledDate, 1),
      },
    },
    select: { id: true },
  });

  if (existing) {
    throw new PlanServiceError(
      "The selected date already has a workout; choose an empty date or delete its planned workout before generating another",
      "CONFLICT",
      409,
    );
  }
}

function assertSingleDayPlan(draft: PlanDraft, scheduledDate: Date): void {
  if (draft.workouts.length !== 1) {
    throw validationError("A single-day plan must contain exactly one workout");
  }

  const workout = draft.workouts[0]!;
  if (workout.activityType !== "STRENGTH") {
    throw validationError("A single-day plan must contain a Strength workout");
  }

  if (
    startOfUtcDay(workout.scheduledDate).getTime() !==
    startOfUtcDay(scheduledDate).getTime()
  ) {
    throw validationError("The generated workout must use the selected date");
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
  };
}

function toPlanResponse(draft: PlanDraft): PlanResponse {
  return planResponseSchema.parse({
    workouts: draft.workouts.map((workout) => ({
      scheduledDate: workout.scheduledDate,
      activityType: workout.activityType,
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
