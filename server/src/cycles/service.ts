import { Prisma, PrismaClient } from "@prisma/client";
import {
  addUtcDays,
  closeCycle as closeCycleDomain,
  distributeFirstWeek,
  getCycleReviewStatus,
  startOfLocalDate,
  startOfUtcDay,
  type CycleCloseWorkout,
  type CycleReviewStatus,
} from "@fitness/shared";

export type CycleDraftProfile = {
  weeklyTrainingDays: number;
  sessionDurationMinutes: number;
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
  cycleNumber: number;
  startDate: Date;
  endDate: Date;
  timezone: string;
  firstWeekDates: Date[];
};

export type ClosedCycleResult = ReturnType<typeof closeCycleDomain> & {
  closedAt: Date;
};

type CycleDatabase = PrismaClient | Prisma.TransactionClient;

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
    database: CycleDatabase = this.prisma,
  ): Promise<CycleDraft> {
    if (database === this.prisma) {
      return this.runSerializableTransaction((tx) =>
        this.createDraft(userId, profile, now, tx),
      );
    }

    const startDate = startOfLocalDate(now, profile.timezone);
    const endDate = addUtcDays(startDate, 6);
    const firstWeekDates = distributeFirstWeek(
      startDate,
      profile.weeklyTrainingDays,
    );

    const existingOpenCycle = await database.trainingCycle.findFirst({
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

    const cycle = await database.trainingCycle.create({
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
    const endDate = addUtcDays(startDate, 6);

    return this.prisma.$transaction(async (tx) => {
      const cycle = await tx.trainingCycle.findFirst({
        where: { id: cycleId, userId },
        select: { id: true, status: true, cycleNumber: true },
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

      const highestCycle = await tx.trainingCycle.aggregate({
        where: { userId, cycleNumber: { not: null } },
        _max: { cycleNumber: true },
      });
      const cycleNumber =
        cycle.cycleNumber ?? (highestCycle._max.cycleNumber ?? 0) + 1;

      const activeCycle = await tx.trainingCycle.update({
        where: { id: cycleId },
        data: {
          status: "ACTIVE",
          cycleNumber,
          startDate,
          endDate,
          timezone,
        },
        select: {
          id: true,
          status: true,
          cycleNumber: true,
          startDate: true,
          endDate: true,
          timezone: true,
        },
      });

      if (!activeCycle.timezone || activeCycle.cycleNumber === null) {
        throw new CycleServiceError(
          "An active cycle must have timezone and cycle number snapshots",
          "INVALID_STATE",
          409,
        );
      }

      return {
        ...activeCycle,
        status: "ACTIVE" as const,
        cycleNumber: activeCycle.cycleNumber,
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
    const plannedWorkoutCount = cycle.workouts.filter(
      (workout) => workout.status === "PLANNED",
    ).length;

    return getCycleReviewStatus({
      cycleStatus: cycle.status,
      cycleEndDate,
      now,
      timezone,
      plannedWorkoutCount,
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
      const plannedWorkoutCount = cycle.workouts.filter(
        (workout) => workout.status === "PLANNED",
      ).length;
      const reviewStatus = getCycleReviewStatus({
        cycleStatus: cycle.status,
        cycleEndDate,
        now,
        timezone,
        plannedWorkoutCount,
      });

      if (!reviewStatus.reviewAvailable) {
        throw new CycleServiceError(
          reviewBlockedMessage(reviewStatus.blockedReason),
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

      if (result.unresolvedWorkoutIds.length > 0) {
        throw new CycleServiceError(
          "Complete or delete every planned workout before reviewing the cycle",
          "INVALID_STATE",
          409,
        );
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
            status: "NOT_AVAILABLE",
          },
        },
      });

      return {
        ...result,
        closedAt: now,
      };
    });
  }

  private async runSerializableTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (isSerializationConflict(error)) {
        throw new CycleServiceError(
          "The cycle changed while the operation was in progress; please retry",
          "CONFLICT",
          409,
        );
      }
      throw error;
    }
  }
}

function toDomainWorkout(workout: {
  id: string;
  status: "PLANNED" | "COMPLETED";
  completedAt: Date | null;
}): CycleCloseWorkout {
  return {
    id: workout.id,
    status: workout.status,
    completedAt: workout.completedAt,
  };
}

function reviewBlockedMessage(
  reason: ReturnType<typeof getCycleReviewStatus>["blockedReason"],
): string {
  if (reason === "BEFORE_REVIEW_DATE") {
    return "The cycle review is not available until the cycle end date";
  }

  if (reason === "PLANNED_WORKOUTS_REMAINING") {
    return "Complete or delete every planned workout before reviewing the cycle";
  }

  return "Only an active cycle can be reviewed";
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

function isSerializationConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}
