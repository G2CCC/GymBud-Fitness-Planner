import { Prisma, PrismaClient } from "@prisma/client";
import { env } from "../config/env";
import {
  AiClientError,
  type AiClient,
} from "./client";
import {
  weightDecisionSchema,
  weightRecommendationSchema,
  type WeightDecision,
} from "./schemas";
import {
  buildWeightRecommendationRequest,
  type WeightContext,
} from "./prompts/weight";

const nextWorkoutSelect = {
  id: true,
  userId: true,
  cycleId: true,
  activityType: true,
  status: true,
  scheduledDate: true,
  cycle: {
    select: {
      id: true,
      userId: true,
      status: true,
      startDate: true,
      endDate: true,
      workouts: {
        select: {
          id: true,
          status: true,
          scheduledDate: true,
          completedAt: true,
        },
      },
    },
  },
  user: {
    select: {
      profile: {
        select: {
          primaryGoal: true,
        },
      },
    },
  },
  plannedExercises: {
    select: {
      exerciseId: true,
      sortOrder: true,
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

const exerciseSelect = {
  id: true,
  name: true,
  equipment: true,
} satisfies Prisma.ExerciseSelect;

const exerciseLogSelect = {
  id: true,
  exerciseId: true,
  workoutLog: {
    select: {
      workout: {
        select: {
          id: true,
          userId: true,
          status: true,
          scheduledDate: true,
          completedAt: true,
        },
      },
    },
  },
  setLogs: {
    orderBy: { setNumber: "asc" },
    select: {
      setNumber: true,
      actualReps: true,
      actualWeight: true,
      weightUnit: true,
    },
  },
} satisfies Prisma.ExerciseLogSelect;

const decisionWorkoutSelect = {
  id: true,
  status: true,
  activityType: true,
  cycle: {
    select: {
      id: true,
      userId: true,
      status: true,
      startDate: true,
    },
  },
  plannedExercises: {
    select: {
      id: true,
      exerciseId: true,
    },
  },
} satisfies Prisma.ScheduledWorkoutSelect;

const scheduledWorkoutResultInclude = {
  plannedExercises: {
    include: {
      plannedSets: true,
      exercise: true,
    },
    orderBy: { sortOrder: "asc" },
  },
} satisfies Prisma.ScheduledWorkoutInclude;

type DatabaseClient = PrismaClient | Prisma.TransactionClient;
type NextWorkout = Prisma.ScheduledWorkoutGetPayload<{
  select: typeof nextWorkoutSelect;
}>;
type ExerciseLogRecord = Prisma.ExerciseLogGetPayload<{
  select: typeof exerciseLogSelect;
}>;
type DecisionWorkout = Prisma.ScheduledWorkoutGetPayload<{
  select: typeof decisionWorkoutSelect;
}>;
export type ScheduledWorkoutWithPlan = Prisma.ScheduledWorkoutGetPayload<{
  include: typeof scheduledWorkoutResultInclude;
}>;

export type WeightRecommendation = {
  id: string;
  exerciseId: string;
  workoutId: string;
  recommendedWeight: number;
  weightUnit: "KG" | "LB";
  reason: string;
  confidence: "low" | "medium" | "high";
  status: string;
  inputContext: WeightContext;
  createdAt: Date;
};

export class WeightServiceError extends Error {
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
    this.name = "WeightServiceError";
  }
}

export class WeightService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly aiClient: AiClient,
    private readonly model = env.aiModel,
  ) {}

  async recommendNextWeight(
    userId: string,
    exerciseId: string,
    nextWorkoutId: string,
  ): Promise<WeightRecommendation> {
    const workout = await this.prisma.scheduledWorkout.findFirst({
      where: { id: nextWorkoutId, userId },
      select: nextWorkoutSelect,
    });

    if (!workout) {
      throw new WeightServiceError("Workout not found", "NOT_FOUND", 404);
    }

    assertNextWorkout(workout);
    await assertCurrentCycle(this.prisma, userId, workout);

    const plannedExercise = workout.plannedExercises.find(
      (exercise) => exercise.exerciseId === exerciseId,
    );
    if (!plannedExercise) {
      throw validationError("The exercise is not planned in the next workout");
    }

    const profile = workout.user.profile;
    if (!profile) {
      throw new WeightServiceError(
        "The user profile is required before recommending weight",
        "CONFLICT",
        409,
      );
    }

    const exercise = await this.prisma.exercise.findFirst({
      where: {
        id: exerciseId,
        OR: [{ ownerId: null }, { ownerId: userId }],
      },
      select: exerciseSelect,
    });

    if (!exercise) {
      throw new WeightServiceError("Exercise not found", "NOT_FOUND", 404);
    }

    const history = await this.prisma.exerciseLog.findMany({
      where: {
        exerciseId,
        workoutLog: {
          workout: {
            userId,
            status: "COMPLETED",
          },
        },
      },
      select: exerciseLogSelect,
    });
    const orderedHistory = [...history].sort(
      (left, right) =>
        getRecordTime(right).getTime() - getRecordTime(left).getTime(),
    );
    if (orderedHistory.length === 0) {
      throw new WeightServiceError(
        "A completed record is required before recommending the next weight",
        "CONFLICT",
        409,
      );
    }
    const preferredUnit = getPreferredWeightUnit(
      plannedExercise.plannedSets,
      orderedHistory,
    );
    const context = buildWeightContext(
      workout,
      exerciseId,
      profile,
      plannedExercise.plannedSets,
      orderedHistory,
      preferredUnit,
    );

    let response: ReturnType<typeof weightRecommendationSchema.parse>;
    try {
      response = await this.aiClient.generateJson(
        buildWeightRecommendationRequest(exercise, context, this.model),
        weightRecommendationSchema,
      );
    } catch (error) {
      throw mapAiError(error);
    }

    const recommendation = await this.prisma.aIRecommendation.create({
      data: {
        userId,
        exerciseId,
        workoutId: nextWorkoutId,
        kind: "NEXT_WEIGHT",
        recommendedWeight: response.recommendedWeight,
        weightUnit: response.weightUnit,
        reason: response.reason,
        status: "PENDING",
        inputContext: context as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      id: recommendation.id,
      exerciseId,
      workoutId: nextWorkoutId,
      recommendedWeight: response.recommendedWeight,
      weightUnit: response.weightUnit,
      reason: response.reason,
      confidence: response.confidence,
      status: recommendation.status,
      inputContext: context,
      createdAt: recommendation.createdAt,
    };
  }

  async applyWeightDecision(
    userId: string,
    recommendationId: string,
    decision: unknown,
  ): Promise<ScheduledWorkoutWithPlan> {
    const parsed = weightDecisionSchema.safeParse(decision);
    if (!parsed.success) {
      throw validationError(parsed.error.message);
    }

    return this.prisma.$transaction(async (tx) => {
      const recommendation = await tx.aIRecommendation.findFirst({
        where: {
          id: recommendationId,
          userId,
          kind: "NEXT_WEIGHT",
        },
        select: {
          id: true,
          status: true,
          exerciseId: true,
          workoutId: true,
          recommendedWeight: true,
          weightUnit: true,
        },
      });

      if (!recommendation) {
        throw new WeightServiceError(
          "Weight recommendation not found",
          "NOT_FOUND",
          404,
        );
      }
      if (recommendation.status !== "PENDING") {
        throw new WeightServiceError(
          "This weight recommendation has already been decided",
          "CONFLICT",
          409,
        );
      }
      if (
        !recommendation.exerciseId ||
        !recommendation.workoutId ||
        recommendation.recommendedWeight === null ||
        !recommendation.weightUnit
      ) {
        throw new WeightServiceError(
          "The weight recommendation is incomplete",
          "CONFLICT",
          409,
        );
      }

      const workout = await tx.scheduledWorkout.findFirst({
        where: { id: recommendation.workoutId, userId },
        select: decisionWorkoutSelect,
      });
      if (!workout) {
        throw new WeightServiceError("Workout not found", "NOT_FOUND", 404);
      }

      assertDecisionWorkout(workout);
      await assertCurrentCycle(tx, userId, workout);

      const plannedExerciseIds = workout.plannedExercises
        .filter((exercise) => exercise.exerciseId === recommendation.exerciseId)
        .map((exercise) => exercise.id);
      if (plannedExerciseIds.length === 0) {
        throw validationError("The exercise is not planned in the next workout");
      }

      let status: "ACCEPTED" | "MODIFIED" | "REJECTED";
      if (parsed.data.action === "REJECT") {
        status = "REJECTED";
      } else {
        const weight =
          parsed.data.action === "MODIFY"
            ? parsed.data.weight
            : recommendation.recommendedWeight;
        const weightUnit =
          parsed.data.action === "MODIFY"
            ? parsed.data.weightUnit
            : recommendation.weightUnit;

        await tx.plannedSet.updateMany({
          where: { plannedExerciseId: { in: plannedExerciseIds } },
          data: {
            plannedWeight: weight,
            weightUnit,
          },
        });
        status = parsed.data.action === "MODIFY" ? "MODIFIED" : "ACCEPTED";
      }

      const updatedRecommendation = await tx.aIRecommendation.updateMany({
        where: {
          id: recommendation.id,
          userId,
          kind: "NEXT_WEIGHT",
          status: "PENDING",
        },
        data: { status },
      });
      if (updatedRecommendation.count !== 1) {
        throw new WeightServiceError(
          "This weight recommendation was decided concurrently",
          "CONFLICT",
          409,
        );
      }

      return tx.scheduledWorkout.findFirstOrThrow({
        where: { id: workout.id, userId },
        include: scheduledWorkoutResultInclude,
      });
    });
  }
}

function assertNextWorkout(workout: NextWorkout): void {
  if (workout.activityType !== "STRENGTH") {
    throw new WeightServiceError(
      "Weight recommendations are only available for strength workouts",
      "CONFLICT",
      409,
    );
  }
  if (workout.status !== "PLANNED") {
    throw new WeightServiceError(
      "Only a planned workout can receive a weight recommendation",
      "CONFLICT",
      409,
    );
  }
}

function assertDecisionWorkout(workout: DecisionWorkout): void {
  if (workout.activityType !== "STRENGTH" || workout.status !== "PLANNED") {
    throw new WeightServiceError(
      "Only a planned strength workout can receive a weight decision",
      "CONFLICT",
      409,
    );
  }
}

async function assertCurrentCycle(
  database: DatabaseClient,
  userId: string,
  workout: {
    cycle: {
      id: string;
      userId: string;
      status: string;
      startDate: Date;
    };
  },
): Promise<void> {
  if (workout.cycle.userId !== userId) {
    throw new WeightServiceError(
      "The workout cycle does not belong to the current user",
      "NOT_FOUND",
      404,
    );
  }

  if (workout.cycle.status !== "ACTIVE") {
    throw new WeightServiceError(
      "The workout cycle does not accept weight changes",
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
    throw new WeightServiceError(
      "The workout cycle is read-only after a newer cycle exists",
      "CONFLICT",
      409,
    );
  }
}

function buildWeightContext(
  workout: NextWorkout,
  exerciseId: string,
  profile: { primaryGoal: string },
  plannedSets: NextWorkout["plannedExercises"][number]["plannedSets"],
  history: ExerciseLogRecord[],
  preferredUnit: "KG" | "LB",
): WeightContext {
  const recentPerformance = history.slice(0, 5).map((record) => {
    return {
      workoutId: record.workoutLog.workout.id,
      scheduledDate: record.workoutLog.workout.scheduledDate.toISOString(),
      completedAt: record.workoutLog.workout.completedAt?.toISOString() ?? null,
      sets: record.setLogs.map((set) => ({
        setNumber: set.setNumber,
        reps: set.actualReps,
        weight: set.actualWeight,
        weightUnit: set.weightUnit,
      })),
    };
  });

  const weightedSets = history.flatMap((record) =>
    record.setLogs.map((set) => ({
      weight: set.actualWeight,
      weightUnit: set.weightUnit,
      reps: set.actualReps,
      workoutId: record.workoutLog.workout.id,
      recordedAt: getRecordTime(record).toISOString(),
    })),
  );
  const bestCandidates = weightedSets.filter(
    (set) => set.weightUnit === preferredUnit,
  );
  const best = [...bestCandidates].sort((left, right) => right.weight - left.weight)[0] ?? null;

  const cycleWorkouts = workout.cycle.workouts;
  const completed = cycleWorkouts.filter((item) => item.status === "COMPLETED");
  const planned = cycleWorkouts.filter((item) => item.status === "PLANNED");
  const cancelled = cycleWorkouts.filter((item) => item.status === "CANCELLED");
  const targetReps = Array.from(
    new Set(plannedSets.map((set) => set.targetReps)),
  );

  return {
    recentPerformance,
    currentCycleSummary: {
      cycleId: workout.cycle.id,
      startDate: workout.cycle.startDate.toISOString(),
      endDate: workout.cycle.endDate.toISOString(),
      workoutCount: cycleWorkouts.length,
      completedWorkoutCount: completed.length,
      cancelledWorkoutCount: cancelled.length,
      plannedWorkoutCount: planned.length,
    },
    allTimeBest: best
      ? {
          weight: best.weight,
          weightUnit: best.weightUnit,
          reps: best.reps,
          workoutId: best.workoutId,
          recordedAt: best.recordedAt,
        }
      : null,
    currentGoal: {
      primaryGoal: profile.primaryGoal,
    },
    nextWorkoutTarget: {
      workoutId: workout.id,
      scheduledDate: workout.scheduledDate.toISOString(),
      exerciseId,
      sets: plannedSets.length,
      targetReps: targetReps.length === 1 ? targetReps[0]! : targetReps,
      plannedWeights: plannedSets.map((set) => ({
        setNumber: set.setNumber,
        weight: set.plannedWeight,
        weightUnit: set.weightUnit,
      })),
    },
  };
}

function getRecordTime(record: ExerciseLogRecord): Date {
  return record.workoutLog.workout.completedAt ?? record.workoutLog.workout.scheduledDate;
}

function getPreferredWeightUnit(
  plannedSets: NextWorkout["plannedExercises"][number]["plannedSets"],
  history: ExerciseLogRecord[],
): "KG" | "LB" {
  return (
    plannedSets.find((set) => set.weightUnit)?.weightUnit ??
    history
      .flatMap((record) => record.setLogs)
      .find((set) => set.weightUnit)?.weightUnit ??
    "KG"
  );
}

function validationError(message: string): WeightServiceError {
  return new WeightServiceError(message, "VALIDATION_ERROR", 400);
}

function mapAiError(error: unknown): WeightServiceError {
  if (error instanceof WeightServiceError) {
    return error;
  }
  if (error instanceof AiClientError) {
    return new WeightServiceError(
      error.message,
      "AI_ERROR",
      error.code === "NOT_CONFIGURED" ? 409 : 502,
    );
  }
  return new WeightServiceError(
    "AI weight recommendation failed",
    "AI_ERROR",
    502,
  );
}
