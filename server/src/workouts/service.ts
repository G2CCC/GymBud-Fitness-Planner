import { Prisma, PrismaClient } from "@prisma/client";
import {
  backfillCompletionInputSchema,
  cancelWorkout as cancelWorkoutState,
  cardioWorkoutLogInputSchema,
  completeWorkout as completeWorkoutState,
  extraWorkoutInputSchema,
  rescheduleWorkout as rescheduleWorkoutState,
  sportWorkoutLogInputSchema,
  strengthWorkoutLogInputSchema,
  type Location,
  type WorkoutLogInput,
  updateWorkoutLocation as updateWorkoutLocationState,
  validateCompletionTimestamp,
} from "@fitness/shared";
import {
  rescheduleWorkoutInputSchema,
  updateWorkoutLocationInputSchema,
} from "@fitness/shared/domain/workouts/validation";
import { z } from "zod";

const workoutSelect = {
  id: true,
  userId: true,
  cycleId: true,
  activityType: true,
  scheduledDate: true,
  location: true,
  durationMinutes: true,
  status: true,
  source: true,
  cancellationReason: true,
  completedAt: true,
  plannedDetails: true,
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

export type WorkoutRecord = Prisma.ScheduledWorkoutGetPayload<{
  select: typeof workoutSelect;
}>;

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

    return workout;
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
          cancellationReason: null,
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

  async cancelWorkout(
    userId: string,
    workoutId: string,
  ): Promise<WorkoutRecord> {
    return this.prisma.$transaction(async (tx) => {
      const context = await this.getWritableWorkout(tx, userId, workoutId);
      const transition = this.runTransition(() =>
        cancelWorkoutState(toTransition(context.workout, context.hasNextCycle)),
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
          completedAt: null,
          cancellationReason: "USER",
        },
      });

      assertSingleUpdate(updated.count, "Workout changed while cancelling");
      return this.getWorkoutInTransaction(tx, userId, workoutId);
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
        data: { scheduledDate: transition.scheduledDate },
      });

      assertSingleUpdate(updated.count, "Workout changed while rescheduling");
      return this.getWorkoutInTransaction(tx, userId, workoutId);
    });
  }

  async updateWorkoutLocation(
    userId: string,
    workoutId: string,
    location: Location,
  ): Promise<WorkoutRecord> {
    const parsed = updateWorkoutLocationInputSchema.safeParse({ location });

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    return this.prisma.$transaction(async (tx) => {
      const context = await this.getWritableWorkout(tx, userId, workoutId);
      const transition = this.runTransition(() =>
        updateWorkoutLocationState(
          toTransition(context.workout, context.hasNextCycle),
          parsed.data.location,
        ),
      );

      const updated = await tx.scheduledWorkout.updateMany({
        where: {
          id: workoutId,
          userId,
          cycleId: context.workout.cycleId,
          status: "PLANNED",
        },
        data: { location: transition.location },
      });

      assertSingleUpdate(updated.count, "Workout changed while moving");
      return this.getWorkoutInTransaction(tx, userId, workoutId);
    });
  }

  async createExtraWorkout(
    userId: string,
    input: unknown,
  ): Promise<WorkoutRecord> {
    const parsed = extraWorkoutInputSchema.safeParse(input);

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
          "An active cycle is required for an extra workout",
          "INVALID_STATE",
          409,
        );
      }

      return tx.scheduledWorkout.create({
        data: {
          userId,
          cycleId: cycle.id,
          activityType: parsed.data.activityType,
          scheduledDate: parsed.data.scheduledDate,
          location: parsed.data.location,
          durationMinutes: parsed.data.durationMinutes,
          source: "EXTRA",
          status: "PLANNED",
          ...(parsed.data.plannedDetails
            ? {
                plannedDetails: parsed.data.plannedDetails as Prisma.InputJsonValue,
              }
            : {}),
        },
        select: workoutSelect,
      });
    });
  }

  async saveWorkoutLog(
    userId: string,
    workoutId: string,
    input: unknown,
  ): Promise<WorkoutLogRecord> {
    return this.prisma.$transaction(async (tx) => {
      const context = await this.getWritableWorkout(tx, userId, workoutId);

      if (context.workout.status === "CANCELLED") {
        throw new WorkoutServiceError(
          "A cancelled workout cannot receive a log",
          "INVALID_STATE",
          409,
        );
      }

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
    if (workout.status === "CANCELLED") {
      throw new WorkoutServiceError(
        "A cancelled workout cannot receive a log",
        "INVALID_STATE",
        409,
      );
    }

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
          availableLocations: { has: workout.location },
          OR: [{ ownerId: null }, { ownerId: userId }],
        },
        select: { id: true },
      });

      if (!exercise) {
        throw new WorkoutServiceError(
          "Exercise is not available to this user at the workout location",
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
            actualWeight: setInput.weight ?? null,
            weightUnit: setInput.weightUnit ?? null,
          },
          update: {
            actualReps: setInput.reps,
            actualWeight: setInput.weight ?? null,
            weightUnit: setInput.weightUnit ?? null,
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

    return workout;
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
    location: workout.location,
    completedAt: workout.completedAt,
    cancellationReason: workout.cancellationReason,
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
