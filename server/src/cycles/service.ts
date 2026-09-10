import {
  Prisma,
  PrismaClient,
  type CancellationReason as PrismaCancellationReason,
} from "@prisma/client";
import {
  addUtcDays,
  closeCycle as closeCycleDomain,
  distributeFirstWeek,
  restoreAutoCancelledWorkout,
  startOfUtcDay,
  type CycleCloseWorkout,
  type Location,
} from "@fitness/shared";

export type CycleDraftProfile = {
  weeklyTrainingDays: number;
  sessionDurationMinutes: number;
  defaultLocation: Location;
};

export type CycleDraft = {
  id: string;
  status: "DRAFT";
  startDate: Date;
  endDate: Date;
  firstWeekDates: Date[];
};

export type ClosedCycleResult = ReturnType<typeof closeCycleDomain> & {
  closedAt: Date;
};

export class CycleServiceError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "CONFLICT" | "INVALID_STATE",
    readonly statusCode: 404 | 409,
  ) {
    super(message);
    this.name = "CycleServiceError";
  }
}

export class CycleService {
  constructor(private readonly prisma: PrismaClient) {}

  async createDraft(
    userId: string,
    profile: CycleDraftProfile,
    now = new Date(),
  ): Promise<CycleDraft> {
    const startDate = startOfUtcDay(now);
    const endDate = addUtcDays(startDate, 27);
    const firstWeekDates = distributeFirstWeek(
      startDate,
      profile.weeklyTrainingDays,
    );

    const existingOpenCycle = await this.prisma.trainingCycle.findFirst({
      where: {
        userId,
        status: { in: ["DRAFT", "ACTIVE"] },
      },
      select: { id: true },
    });

    if (existingOpenCycle) {
      throw new CycleServiceError(
        "The user already has a draft or active cycle",
        "CONFLICT",
        409,
      );
    }

    const cycle = await this.prisma.trainingCycle.create({
      data: {
        userId,
        startDate,
        endDate,
        status: "DRAFT",
      },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    });

    return {
      ...cycle,
      status: "DRAFT",
      firstWeekDates,
    };
  }

  async close(
    userId: string,
    cycleId: string,
    now = new Date(),
  ): Promise<ClosedCycleResult> {
    return this.prisma.$transaction(async (tx) => {
      const cycle = await tx.trainingCycle.findFirst({
        where: { id: cycleId, userId },
        include: {
          workouts: {
            select: {
              id: true,
              status: true,
              completedAt: true,
              cancellationReason: true,
            },
          },
        },
      });

      if (!cycle) {
        throw new CycleServiceError(
          "Training cycle not found",
          "NOT_FOUND",
          404,
        );
      }

      if (cycle.status !== "ACTIVE") {
        throw new CycleServiceError(
          "Only an active cycle can be closed",
          "INVALID_STATE",
          409,
        );
      }

      let result: ReturnType<typeof closeCycleDomain>;
      try {
        result = closeCycleDomain({
          cycleId: cycle.id,
          cycleStatus: cycle.status,
          workouts: cycle.workouts.map(toDomainWorkout),
        }, now);
      } catch (error) {
        throw new CycleServiceError(
          error instanceof Error ? error.message : "Cycle cannot be closed",
          "INVALID_STATE",
          409,
        );
      }

      for (const workoutUpdate of result.workoutUpdates) {
        const updated = await tx.scheduledWorkout.updateMany({
          where: {
            id: workoutUpdate.id,
            cycleId,
            status: "PLANNED",
          },
          data: {
            status: "CANCELLED",
            cancellationReason: "AUTO_CYCLE_CLOSE",
          },
        });

        if (updated.count !== 1) {
          throw new CycleServiceError(
            "A workout changed while the cycle was closing",
            "CONFLICT",
            409,
          );
        }
      }

      await tx.trainingCycle.update({
        where: { id: cycleId },
        data: {
          status: result.cycleStatus,
          closedAt: now,
        },
      });

      await tx.cycleReviewSnapshot.create({
        data: {
          cycleId,
          objectiveSummary: result.objectiveSummary as Prisma.InputJsonValue,
          conclusions: {
            status: "PENDING",
          },
          nextCycleDraft: {
            status: result.nextCycleMayBeGenerated ? "PENDING" : "NOT_AVAILABLE",
          },
        },
      });

      return {
        ...result,
        closedAt: now,
      };
    });
  }

  async restoreAutoCancelledWorkout(
    userId: string,
    cycleId: string,
    workoutId: string,
    newScheduledDate: Date,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const cycle = await tx.trainingCycle.findFirst({
        where: { id: cycleId, userId },
        select: {
          id: true,
          startDate: true,
          status: true,
        },
      });

      if (!cycle) {
        throw new CycleServiceError(
          "Training cycle not found",
          "NOT_FOUND",
          404,
        );
      }

      const workout = await tx.scheduledWorkout.findFirst({
        where: { id: workoutId, cycleId, userId },
        select: {
          id: true,
          status: true,
          cancellationReason: true,
        },
      });

      if (!workout) {
        throw new CycleServiceError(
          "Workout not found in this cycle",
          "NOT_FOUND",
          404,
        );
      }

      const hasNextCycle = Boolean(
        await tx.trainingCycle.findFirst({
          where: {
            userId,
            id: { not: cycleId },
            startDate: { gt: cycle.startDate },
          },
          select: { id: true },
        }),
      );

      let restored: ReturnType<typeof restoreAutoCancelledWorkout>;
      try {
        restored = restoreAutoCancelledWorkout({
          cycleStatus: cycle.status,
          hasNextCycle,
          workout: {
            status: workout.status,
            cancellationReason: workout.cancellationReason,
          },
          newScheduledDate,
        });
      } catch (error) {
        throw new CycleServiceError(
          error instanceof Error ? error.message : "Workout cannot be restored",
          "INVALID_STATE",
          409,
        );
      }

      const update = await tx.scheduledWorkout.updateMany({
        where: {
          id: workoutId,
          cycleId,
          userId,
          status: "CANCELLED",
          cancellationReason: "AUTO_CYCLE_CLOSE",
        },
        data: {
          status: restored.status,
          cancellationReason: null,
          scheduledDate: restored.scheduledDate,
        },
      });

      if (update.count !== 1) {
        throw new CycleServiceError(
          "The workout changed while it was being restored",
          "CONFLICT",
          409,
        );
      }

      await tx.trainingCycle.update({
        where: { id: cycleId },
        data: {
          status: "ACTIVE",
          closedAt: null,
        },
      });

      await tx.cycleReviewSnapshot.deleteMany({ where: { cycleId } });

      return {
        id: workoutId,
        ...restored,
      };
    });
  }
}

function toDomainWorkout(workout: {
  id: string;
  status: PrismaCycleWorkoutStatus;
  completedAt: Date | null;
  cancellationReason: PrismaCancellationReason | null;
}): CycleCloseWorkout {
  return {
    id: workout.id,
    status: workout.status,
    completedAt: workout.completedAt,
    cancellationReason: workout.cancellationReason,
  };
}

type PrismaCycleWorkoutStatus = "PLANNED" | "COMPLETED" | "CANCELLED";
