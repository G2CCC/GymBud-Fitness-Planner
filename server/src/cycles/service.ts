import {
  Prisma,
  PrismaClient,
  type CancellationReason as PrismaCancellationReason,
} from "@prisma/client";
import {
  addUtcDays,
  closeCycle as closeCycleDomain,
  distributeFirstWeek,
  getCycleReviewStatus,
  restoreAutoCancelledWorkout,
  startOfLocalDate,
  startOfUtcDay,
  type CycleCloseWorkout,
  type CycleReviewStatus,
  type Location,
} from "@fitness/shared";

export type CycleDraftProfile = {
  weeklyTrainingDays: number;
  sessionDurationMinutes: number;
  defaultLocation: Location;
  timezone: string;
};

export type CycleDraft = {
  id: string;
  status: "DRAFT";
  startDate: Date;
  endDate: Date;
  timezone: string;
  firstWeekDates: Date[];
};

export type ActiveCycle = {
  id: string;
  status: "ACTIVE";
  startDate: Date;
  endDate: Date;
  timezone: string;
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
    const startDate = startOfLocalDate(now, profile.timezone);
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
        timezone: profile.timezone,
        status: "DRAFT",
      },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        timezone: true,
      },
    });

    return {
      ...cycle,
      status: "DRAFT",
      timezone: cycle.timezone ?? profile.timezone,
      firstWeekDates,
    };
  }

  async activateDraft(
    userId: string,
    cycleId: string,
    timezone: string,
    now = new Date(),
  ): Promise<ActiveCycle> {
    const startDate = startOfLocalDate(now, timezone);
    const endDate = addUtcDays(startDate, 27);

    return this.prisma.$transaction(async (tx) => {
      const cycle = await tx.trainingCycle.findFirst({
        where: { id: cycleId, userId },
        select: { id: true, status: true },
      });

      if (!cycle) {
        throw new CycleServiceError(
          "Training cycle not found",
          "NOT_FOUND",
          404,
        );
      }

      if (cycle.status !== "DRAFT") {
        throw new CycleServiceError(
          "Only a draft cycle can be activated",
          "INVALID_STATE",
          409,
        );
      }

      const profile = await tx.userProfile.findUnique({
        where: { userId },
        select: { weeklyTrainingDays: true },
      });

      if (!profile) {
        throw new CycleServiceError(
          "The user profile is required before activating a cycle",
          "INVALID_STATE",
          409,
        );
      }

      const firstWeekDates = distributeFirstWeek(
        startDate,
        profile.weeklyTrainingDays,
      );

      const activeCycle = await tx.trainingCycle.update({
        where: { id: cycleId },
        data: {
          status: "ACTIVE",
          startDate,
          endDate,
          timezone,
        },
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          timezone: true,
        },
      });

      if (!activeCycle.timezone) {
        throw new CycleServiceError(
          "An active cycle must have a timezone snapshot",
          "INVALID_STATE",
          409,
        );
      }

      return {
        ...activeCycle,
        status: "ACTIVE" as const,
        timezone: activeCycle.timezone,
        firstWeekDates,
      };
    });
  }

  async getReviewStatus(
    userId: string,
    cycleId: string,
    now = new Date(),
  ): Promise<CycleReviewStatus> {
    const cycle = await this.prisma.trainingCycle.findFirst({
      where: { id: cycleId, userId },
      select: {
        status: true,
        endDate: true,
        timezone: true,
        workouts: {
          select: {
            scheduledDate: true,
            status: true,
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

    const timezone = requireCycleTimezone(cycle.status, cycle.timezone);
    const cycleEndDate = startOfUtcDay(cycle.endDate);
    const finalDayWorkoutsResolved = areFinalDayWorkoutsResolved(
      cycle.workouts,
      cycleEndDate,
    );

    return getCycleReviewStatus({
      cycleStatus: cycle.status,
      cycleEndDate,
      now,
      timezone,
      finalDayWorkoutsResolved,
    });
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
              scheduledDate: true,
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

      const timezone = requireCycleTimezone(cycle.status, cycle.timezone);
      const cycleEndDate = startOfUtcDay(cycle.endDate);
      const finalDayWorkoutsResolved = areFinalDayWorkoutsResolved(
        cycle.workouts,
        cycleEndDate,
      );
      const reviewStatus = getCycleReviewStatus({
        cycleStatus: cycle.status,
        cycleEndDate,
        now,
        timezone,
        finalDayWorkoutsResolved,
      });

      if (!reviewStatus.reviewRequired) {
        throw new CycleServiceError(
          "The cycle review is not due yet",
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
            status: result.nextCycleMayBeGenerated
              ? "PENDING"
              : "RESET_REQUIRED",
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

function areFinalDayWorkoutsResolved(
  workouts: ReadonlyArray<{
    scheduledDate: Date;
    status: PrismaCycleWorkoutStatus;
  }>,
  cycleEndDate: Date,
): boolean {
  const finalDayWorkouts = workouts.filter(
    (workout) =>
      startOfUtcDay(workout.scheduledDate).getTime() ===
      cycleEndDate.getTime(),
  );

  return (
    finalDayWorkouts.length > 0 &&
    finalDayWorkouts.every((workout) => workout.status !== "PLANNED")
  );
}

function requireCycleTimezone(
  cycleStatus: "DRAFT" | "ACTIVE" | "CLOSED",
  timezone: string | null,
): string {
  if (timezone) {
    return timezone;
  }

  if (cycleStatus === "ACTIVE") {
    throw new CycleServiceError(
      "The active cycle has no timezone snapshot",
      "INVALID_STATE",
      409,
    );
  }

  // Legacy drafts/closed cycles created before timezone snapshots are only
  // read for a non-actionable prompt. UTC is a deterministic compatibility
  // fallback; all newly activated cycles always persist their timezone.
  return "UTC";
}
