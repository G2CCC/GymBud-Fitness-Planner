import { Prisma, PrismaClient } from "@prisma/client";
import {
  backfillCompletionInputSchema,
  cardioWorkoutLogInputSchema,
  completeWorkout as completeWorkoutState,
  createWorkoutInputSchema,
  rescheduleWorkout as rescheduleWorkoutState,
  sportWorkoutLogInputSchema,
  strengthWorkoutLogInputSchema,
  type WorkoutLogInput,
  validateCompletionTimestamp,
} from "@fitness/shared";
import { rescheduleWorkoutInputSchema } from "@fitness/shared/domain/workouts/validation";
import { z } from "zod";

const workoutSelect = {
  id: true,
  userId: true,
  cycleId: true,
  activityType: true,
  scheduledDate: true,
  durationMinutes: true,
  status: true,
  rescheduleCount: true,
  completedAt: true,
  plannedDetails: true,
  activityOption: {
    select: {
      id: true,
      activityType: true,
      slug: true,
      name: true,
      iconKey: true,
      aiEligible: true,
      sortOrder: true,
      description: true,
    },
  },
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
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ScheduledWorkoutSelect;

const writableWorkoutSelect = {
  ...workoutSelect,
  cycle: {
    select: {
      id: true,
      status: true,
      startDate: true,
    },
  },
} satisfies Prisma.ScheduledWorkoutSelect;

const workoutLogInclude = {
  exerciseLogs: {
    include: { setLogs: true },
  },
} satisfies Prisma.WorkoutLogInclude;

type WorkoutBaseRecord = Prisma.ScheduledWorkoutGetPayload<{
  select: typeof workoutSelect;
}>;

export type WorkoutRecord = WorkoutBaseRecord & {
  actualDetails: WorkoutActualDetails | null;
  actualExercises: WorkoutActualExercise[];
};

type WorkoutActualDetails = {
  actualDurationMinutes?: number;
  distanceKm?: number;
  paceSecondsPerKm?: number;
  speedKph?: number;
  intensity?: "LOW" | "MODERATE" | "HIGH";
  modality?: string;
  sportName?: string;
  trainingFocus?: string;
  notes?: string;
};

type WorkoutActualExercise = {
  exerciseId: string;
  sortOrder: number;
  sets: Array<{
    setNumber: number;
    actualReps: number;
    actualWeight: number;
    weightUnit: "KG" | "LB";
  }>;
};

const workoutDetailLogSelect = {
  actualDetails: true,
  exerciseLogs: {
    orderBy: { sortOrder: "asc" },
    select: {
      exerciseId: true,
      sortOrder: true,
      setLogs: {
        orderBy: { setNumber: "asc" },
        select: {
          setNumber: true,
          actualReps: true,
          actualWeight: true,
          weightUnit: true,
        },
      },
    },
  },
} satisfies Prisma.WorkoutLogSelect;

type WorkoutDatabaseClient = PrismaClient | Prisma.TransactionClient;

export type WorkoutLogRecord = Prisma.WorkoutLogGetPayload<{
  include: typeof workoutLogInclude;
}>;

export type CompleteWorkoutRequest = {
  completedAt?: Date;
  log?: unknown;
};

export class WorkoutServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "CONFLICT"
      | "INVALID_STATE"
      | "VALIDATION_ERROR",
    readonly statusCode: 400 | 404 | 409,
  ) {
    super(message);
    this.name = "WorkoutServiceError";
  }
}

export class WorkoutService {
  constructor(private readonly prisma: PrismaClient) {}

  async getWorkout(userId: string, workoutId: string): Promise<WorkoutRecord> {
    const workout = await this.prisma.scheduledWorkout.findFirst({
      where: { id: workoutId, userId },
      select: workoutSelect,
    });

    if (!workout) {
      throw new WorkoutServiceError("Workout not found", "NOT_FOUND", 404);
    }

    return this.enrichWorkoutRecord(this.prisma, workout);
  }

  async completeWorkout(
    userId: string,
    workoutId: string,
    input: CompleteWorkoutRequest = {},
    now = new Date(),
  ): Promise<WorkoutRecord> {
    return this.prisma.$transaction(async (tx) => {
      const context = await this.getWritableWorkout(tx, userId, workoutId);
      const transition = this.runTransition(() =>
        completeWorkoutState(
          toTransition(context.workout, context.hasNextCycle),
          { completedAt: input.completedAt },
          now,
        ),
      );

      const updated = await tx.scheduledWorkout.updateMany({
        where: {
          id: workoutId,
          userId,
          cycleId: context.workout.cycleId,
          status: "PLANNED",
        },
        data: {
          status: transition.status,
          completedAt: transition.completedAt,
        },
      });

      assertSingleUpdate(updated.count, "Workout changed while completing");

      if (input.log !== undefined) {
        await this.saveWorkoutLogInTransaction(
          tx,
          userId,
          { ...context.workout, status: "COMPLETED" },
          input.log,
        );
      }

      return this.getWorkoutInTransaction(tx, userId, workoutId);
    });
  }

  async backfillWorkout(
    userId: string,
    workoutId: string,
    input: unknown,
    now = new Date(),
  ): Promise<WorkoutRecord> {
    const parsed = backfillCompletionInputSchema.safeParse(input);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    try {
      validateCompletionTimestamp(parsed.data.completedAt, now);
    } catch (error) {
      throw new WorkoutServiceError(
        error instanceof Error ? error.message : "Invalid completion timestamp",
        "VALIDATION_ERROR",
        400,
      );
    }

    return this.completeWorkout(
      userId,
      workoutId,
      { completedAt: parsed.data.completedAt },
      now,
    );
  }

  async deletePlannedWorkout(
    userId: string,
    workoutId: string,
  ): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      const context = await this.getWritableWorkout(tx, userId, workoutId);

      if (context.workout.status !== "PLANNED") {
        throw new WorkoutServiceError(
          "Completed workouts cannot be deleted",
          "CONFLICT",
          409,
        );
      }

      const deleted = await tx.scheduledWorkout.deleteMany({
        where: {
          id: workoutId,
          userId,
          cycleId: context.workout.cycleId,
          status: "PLANNED",
        },
      });

      assertSingleUpdate(deleted.count, "Workout changed while deleting");
      return { id: workoutId };
    });
  }

  async rescheduleWorkout(
    userId: string,
    workoutId: string,
    scheduledDate: Date,
  ): Promise<WorkoutRecord> {
    const parsed = rescheduleWorkoutInputSchema.safeParse({ scheduledDate });

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    return this.prisma.$transaction(async (tx) => {
      const context = await this.getWritableWorkout(tx, userId, workoutId);
      const transition = this.runTransition(() =>
        rescheduleWorkoutState(
          toTransition(context.workout, context.hasNextCycle),
          parsed.data.scheduledDate,
        ),
      );

      const updated = await tx.scheduledWorkout.updateMany({
        where: {
          id: workoutId,
          userId,
          cycleId: context.workout.cycleId,
          status: "PLANNED",
        },
        data: {
          scheduledDate: transition.scheduledDate,
          rescheduleCount: { increment: 1 },
        },
      });

      assertSingleUpdate(updated.count, "Workout changed while rescheduling");
      return this.getWorkoutInTransaction(tx, userId, workoutId);
    });
  }

  async createWorkout(
    userId: string,
    input: unknown,
  ): Promise<WorkoutRecord> {
    const parsed = createWorkoutInputSchema.safeParse(input);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    return this.prisma.$transaction(async (tx) => {
      const cycle = await tx.trainingCycle.findFirst({
        where: { userId, status: "ACTIVE" },
        orderBy: { startDate: "desc" },
        select: { id: true },
      });

      if (!cycle) {
        throw new WorkoutServiceError(
          "An active cycle is required for a new workout",
          "INVALID_STATE",
          409,
        );
      }

      const plannedExercises = parsed.data.plannedExercises ?? [];
      if (parsed.data.activityType !== "STRENGTH") {
        const activityOption = await tx.activityOption.findUnique({
          where: { id: parsed.data.activityOptionId },
          select: { id: true, activityType: true },
        });

        if (!activityOption) {
          throw new WorkoutServiceError(
            "Activity option is not available",
            "VALIDATION_ERROR",
            400,
          );
        }
        if (activityOption.activityType !== parsed.data.activityType) {
          throw new WorkoutServiceError(
            "Activity option does not match the workout type",
            "VALIDATION_ERROR",
            400,
          );
        }
      }

      if (plannedExercises.length > 0) {
        const legalExercises = await tx.exercise.findMany({
          where: {
            id: { in: plannedExercises.map((exercise) => exercise.exerciseId) },
            OR: [{ ownerId: null }, { ownerId: userId }],
          },
          select: { id: true },
        });
        const legalExerciseIds = new Set(
          legalExercises.map((exercise) => exercise.id),
        );
        const illegalExercise = plannedExercises.find(
          (exercise) => !legalExerciseIds.has(exercise.exerciseId),
        );

        if (illegalExercise) {
          throw new WorkoutServiceError(
            "Exercise is not available to this user",
            "VALIDATION_ERROR",
            400,
          );
        }
      }

      const workoutData: Prisma.ScheduledWorkoutCreateInput = {
          user: { connect: { id: userId } },
          cycle: { connect: { id: cycle.id } },
          activityType: parsed.data.activityType,
          scheduledDate: parsed.data.scheduledDate,
          durationMinutes: parsed.data.durationMinutes,
          status: "PLANNED",
          ...(parsed.data.activityOptionId
            ? { activityOption: { connect: { id: parsed.data.activityOptionId } } }
            : {}),
          ...(parsed.data.plannedDetails
            ? {
                plannedDetails: parsed.data.plannedDetails as Prisma.InputJsonValue,
              }
            : {}),
          ...(plannedExercises.length > 0
            ? {
                plannedExercises: {
                  create: plannedExercises.map((exercise) => ({
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
      };

      const created = await tx.scheduledWorkout.create({
        data: workoutData,
        select: workoutSelect,
      });
      return this.enrichWorkoutRecord(tx, created);
    });
  }

  async saveWorkoutLog(
    userId: string,
    workoutId: string,
    input: unknown,
  ): Promise<WorkoutLogRecord> {
    return this.prisma.$transaction(async (tx) => {
      const context = await this.getWritableWorkout(tx, userId, workoutId);

      return this.saveWorkoutLogInTransaction(
        tx,
        userId,
        context.workout,
        input,
      );
    });
  }

  private async saveWorkoutLogInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    workout: WritableWorkout,
    input: unknown,
  ): Promise<WorkoutLogRecord> {
    const parsed = parseWorkoutLog(workout.activityType, input);
    const workoutLog = await tx.workoutLog.upsert({
      where: { workoutId: workout.id },
      create: { workoutId: workout.id },
      update: {},
      select: { id: true },
    });

    if (parsed.kind === "STRENGTH") {
      await this.persistStrengthLog(
        tx,
        userId,
        workout,
        workoutLog.id,
        parsed.data,
      );
    } else {
      await tx.workoutLog.update({
        where: { id: workoutLog.id },
        data: {
          actualDetails: parsed.data as Prisma.InputJsonValue,
        },
      });
    }

    return tx.workoutLog.findUniqueOrThrow({
      where: { id: workoutLog.id },
      include: workoutLogInclude,
    });
  }

  private async persistStrengthLog(
    tx: Prisma.TransactionClient,
    userId: string,
    workout: WritableWorkout,
    workoutLogId: string,
    input: z.infer<typeof strengthWorkoutLogInputSchema>,
  ): Promise<void> {
    const sortOrders = input.exercises.map((exercise) => exercise.sortOrder);
    if (new Set(sortOrders).size !== sortOrders.length) {
      throw new WorkoutServiceError(
        "Strength exercises cannot repeat sortOrder",
        "VALIDATION_ERROR",
        400,
      );
    }

    await tx.exerciseLog.deleteMany({
      where: {
        workoutLogId,
        sortOrder: { notIn: sortOrders },
      },
    });

    for (const exerciseInput of input.exercises) {
      const exercise = await tx.exercise.findFirst({
        where: {
          id: exerciseInput.exerciseId,
          OR: [{ ownerId: null }, { ownerId: userId }],
        },
        select: { id: true },
      });

      if (!exercise) {
        throw new WorkoutServiceError(
          "Exercise is not available to this user",
          "VALIDATION_ERROR",
          400,
        );
      }

      const setNumbers = exerciseInput.sets.map((set) => set.setNumber);
      if (new Set(setNumbers).size !== setNumbers.length) {
        throw new WorkoutServiceError(
          "Strength sets cannot repeat setNumber",
          "VALIDATION_ERROR",
          400,
        );
      }

      const exerciseLog = await tx.exerciseLog.upsert({
        where: {
          workoutLogId_sortOrder: {
            workoutLogId,
            sortOrder: exerciseInput.sortOrder,
          },
        },
        create: {
          workoutLogId,
          exerciseId: exercise.id,
          sortOrder: exerciseInput.sortOrder,
        },
        update: { exerciseId: exercise.id },
        select: { id: true },
      });

      await tx.setLog.deleteMany({
        where: {
          exerciseLogId: exerciseLog.id,
          setNumber: { notIn: setNumbers },
        },
      });

      for (const setInput of exerciseInput.sets) {
        await tx.setLog.upsert({
          where: {
            exerciseLogId_setNumber: {
              exerciseLogId: exerciseLog.id,
              setNumber: setInput.setNumber,
            },
          },
          create: {
            exerciseLogId: exerciseLog.id,
            setNumber: setInput.setNumber,
            actualReps: setInput.reps,
            actualWeight: setInput.weight,
            weightUnit: setInput.weightUnit,
          },
          update: {
            actualReps: setInput.reps,
            actualWeight: setInput.weight,
            weightUnit: setInput.weightUnit,
          },
        });
      }
    }
  }

  private async getWritableWorkout(
    tx: Prisma.TransactionClient,
    userId: string,
    workoutId: string,
  ): Promise<{ workout: WritableWorkout; hasNextCycle: boolean }> {
    const workout = await tx.scheduledWorkout.findFirst({
      where: { id: workoutId, userId },
      select: writableWorkoutSelect,
    });

    if (!workout) {
      throw new WorkoutServiceError("Workout not found", "NOT_FOUND", 404);
    }

    const hasNextCycle = Boolean(
      await tx.trainingCycle.findFirst({
        where: {
          userId,
          id: { not: workout.cycle.id },
          startDate: { gt: workout.cycle.startDate },
        },
        select: { id: true },
      }),
    );

    if (workout.cycle.status !== "ACTIVE" || hasNextCycle) {
      throw new WorkoutServiceError(
        "The cycle does not accept workout writes",
        "INVALID_STATE",
        409,
      );
    }

    return { workout, hasNextCycle };
  }

  private async getWorkoutInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    workoutId: string,
  ): Promise<WorkoutRecord> {
    const workout = await tx.scheduledWorkout.findFirst({
      where: { id: workoutId, userId },
      select: workoutSelect,
    });

    if (!workout) {
      throw new WorkoutServiceError("Workout not found", "NOT_FOUND", 404);
    }

    return this.enrichWorkoutRecord(tx, workout);
  }

  private async enrichWorkoutRecord(
    database: WorkoutDatabaseClient,
    workout: WorkoutBaseRecord,
  ): Promise<WorkoutRecord> {
    const log = await database.workoutLog.findUnique({
      where: { workoutId: workout.id },
      select: workoutDetailLogSelect,
    });

    return {
      ...workout,
      actualDetails: toActualDetails(log?.actualDetails),
      actualExercises: (log?.exerciseLogs ?? []).map((exercise) => ({
        exerciseId: exercise.exerciseId,
        sortOrder: exercise.sortOrder,
        sets: exercise.setLogs.map((set) => ({
          setNumber: set.setNumber,
          actualReps: set.actualReps,
          actualWeight: set.actualWeight,
          weightUnit: set.weightUnit,
        })),
      })),
    };
  }

  private runTransition<T>(transition: () => T): T {
    try {
      return transition();
    } catch (error) {
      throw new WorkoutServiceError(
        error instanceof Error ? error.message : "Workout transition failed",
        "INVALID_STATE",
        409,
      );
    }
  }
}

type WritableWorkout = Prisma.ScheduledWorkoutGetPayload<{
  select: typeof writableWorkoutSelect;
}>;

function toActualDetails(
  value: Prisma.JsonValue | null | undefined,
): WorkoutActualDetails | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Prisma.JsonObject;
  const details: WorkoutActualDetails = {};
  if (typeof record.actualDurationMinutes === "number") {
    details.actualDurationMinutes = record.actualDurationMinutes;
  }
  if (typeof record.distanceKm === "number") details.distanceKm = record.distanceKm;
  if (typeof record.paceSecondsPerKm === "number") {
    details.paceSecondsPerKm = record.paceSecondsPerKm;
  }
  if (typeof record.speedKph === "number") details.speedKph = record.speedKph;
  if (
    record.intensity === "LOW" ||
    record.intensity === "MODERATE" ||
    record.intensity === "HIGH"
  ) {
    details.intensity = record.intensity;
  }
  if (typeof record.modality === "string") details.modality = record.modality;
  if (typeof record.sportName === "string") details.sportName = record.sportName;
  if (typeof record.trainingFocus === "string") {
    details.trainingFocus = record.trainingFocus;
  }
  if (typeof record.notes === "string") details.notes = record.notes;

  return Object.keys(details).length > 0 ? details : null;
}

function toTransition(
  workout: WritableWorkout,
  hasNextCycle: boolean,
) {
  return {
    id: workout.id,
    status: workout.status,
    cycleStatus: workout.cycle.status,
    hasNextCycle,
    scheduledDate: workout.scheduledDate,
    completedAt: workout.completedAt,
  } as const;
}

function parseWorkoutLog(
  activityType: WorkoutRecord["activityType"],
  input: unknown,
):
  | {
      kind: "STRENGTH";
      data: z.infer<typeof strengthWorkoutLogInputSchema>;
    }
  | {
      kind: "CARDIO";
      data: z.infer<typeof cardioWorkoutLogInputSchema>;
    }
  | {
      kind: "SPORT";
      data: z.infer<typeof sportWorkoutLogInputSchema>;
    } {
  const schema =
    activityType === "STRENGTH"
      ? strengthWorkoutLogInputSchema
      : activityType === "CARDIO"
        ? cardioWorkoutLogInputSchema
        : sportWorkoutLogInputSchema;
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    throw validationError(parsed.error);
  }

  return {
    kind: activityType,
    data: parsed.data as WorkoutLogInput,
  } as ReturnType<typeof parseWorkoutLog>;
}

function validationError(error: z.ZodError): WorkoutServiceError {
  return new WorkoutServiceError(
    error.message,
    "VALIDATION_ERROR",
    400,
  );
}

function assertSingleUpdate(count: number, message: string): void {
  if (count !== 1) {
    throw new WorkoutServiceError(message, "CONFLICT", 409);
  }
}
