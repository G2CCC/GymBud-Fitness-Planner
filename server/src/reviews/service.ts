import { Prisma, PrismaClient } from "@prisma/client";
import {
  buildObjectiveCycleSummary,
  type ObjectiveActualExerciseInput,
  type ObjectiveActualSet,
  type ObjectiveCycleSummary,
  type ObjectiveCycleSummaryInput,
  type ObjectivePlannedExerciseInput,
  type ObjectivePlannedSet,
  type ObjectiveWorkoutInput,
} from "@fitness/shared/domain/reviews/objective-summary";
import type { Location, WeightUnit } from "@fitness/shared";
import { env } from "../config/env";
import { CycleService, CycleServiceError } from "../cycles/service";
import { PlanService, PlanServiceError } from "../ai/plan-service";
import { AiClientError, type AiClient } from "../ai/client";
import {
  cycleReviewResponseSchema,
  planDraftSchema,
  type CycleReviewResponse,
  type PlanDraft,
} from "../ai/schemas";
import { buildCycleReviewRequest } from "../ai/prompts/review";

const cycleReviewSelect = {
  id: true,
  userId: true,
  status: true,
  startDate: true,
  endDate: true,
  timezone: true,
  updatedAt: true,
  reviewSnapshot: {
    select: {
      id: true,
      processedSummary: true,
      objectiveSummary: true,
      conclusions: true,
      nextCycleDraft: true,
    },
  },
  workouts: {
    orderBy: { scheduledDate: "asc" },
    select: {
      id: true,
      activityType: true,
      scheduledDate: true,
      status: true,
      cancellationReason: true,
      durationMinutes: true,
      rescheduleCount: true,
      completedAt: true,
      updatedAt: true,
      plannedDetails: true,
      plannedExercises: {
        orderBy: { sortOrder: "asc" },
        select: {
          exerciseId: true,
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
      workoutLog: {
        select: {
          actualDetails: true,
          updatedAt: true,
          exerciseLogs: {
            orderBy: { sortOrder: "asc" },
            select: {
              exerciseId: true,
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
        },
      },
    },
  },
} satisfies Prisma.TrainingCycleSelect;

type CycleReviewRecord = Prisma.TrainingCycleGetPayload<{
  select: typeof cycleReviewSelect;
}>;

export type CycleReviewResult = {
  reviewId: string;
  cycleId: string;
  cycleStatus: "CLOSED";
  objectiveSummary: ObjectiveCycleSummary;
  processedSummary: string;
  conclusions: CycleReviewResponse["conclusions"];
  nextCycleEligibility: "ELIGIBLE" | "RESET_REQUIRED";
  nextCycleDraftStatus: "PENDING" | "RESET_REQUIRED" | "READY";
};

export type NextCycleDraft = {
  reviewId: string;
  cycle: {
    id: string;
    status: "DRAFT";
    startDate: Date;
    endDate: Date;
    timezone: string;
  };
  plan: PlanDraft;
};

export class CycleReviewServiceError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "CONFLICT" | "INVALID_STATE" | "AI_ERROR",
    readonly statusCode: 404 | 409 | 502,
  ) {
    super(message);
    this.name = "CycleReviewServiceError";
  }
}

export class CycleReviewService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly aiClient: AiClient,
    private readonly cycleService = new CycleService(prisma),
    private readonly planService = new PlanService(prisma, aiClient),
    private readonly model = env.aiModel,
  ) {}

  async buildObjectiveCycleSummary(
    userId: string,
    cycleId: string,
  ): Promise<ObjectiveCycleSummary> {
    const cycle = await this.getCycle(userId, cycleId);
    return buildObjectiveCycleSummary(toObjectiveInput(cycle));
  }

  async generateCycleReview(
    userId: string,
    cycleId: string,
    optionalSummary?: string,
    now = new Date(),
  ): Promise<CycleReviewResult> {
    let cycle = await this.getCycle(userId, cycleId);

    if (cycle.status === "DRAFT") {
      throw new CycleReviewServiceError(
        "Only an active or closed cycle can be reviewed",
        "INVALID_STATE",
        409,
      );
    }

    if (cycle.status === "CLOSED" && !cycle.reviewSnapshot) {
      throw new CycleReviewServiceError(
        "The closed cycle has no review snapshot",
        "INVALID_STATE",
        409,
      );
    }

    if (cycle.reviewSnapshot?.processedSummary) {
      return toCycleReviewResult(
        cycle,
        buildObjectiveCycleSummary(toObjectiveInput(cycle)),
      );
    }

    let objectiveSummary: ObjectiveCycleSummary;
    let reviewVersion: string | null = null;
    if (cycle.status === "ACTIVE") {
      try {
        const reviewStatus = await this.cycleService.getReviewStatus(
          userId,
          cycleId,
          now,
        );
        if (!reviewStatus.reviewRequired) {
          throw new CycleReviewServiceError(
            "The cycle review is not due yet",
            "INVALID_STATE",
            409,
          );
        }
      } catch (error) {
        if (error instanceof CycleReviewServiceError) {
          throw error;
        }
        if (error instanceof CycleServiceError) {
          throw mapCycleError(error);
        }
        throw error;
      }

      reviewVersion = getReviewVersion(cycle);

      // This is a projected summary. The close transaction below will apply
      // these same automatic cancellations after the AI result succeeds.
      objectiveSummary = buildObjectiveCycleSummary(
        toObjectiveInput(cycle, true),
      );
    } else {
      objectiveSummary = buildObjectiveCycleSummary(toObjectiveInput(cycle));
    }

    const request = buildCycleReviewRequest({
      model: this.model,
      cycleId,
      objectiveSummary,
      optionalUserSummary: normalizeOptionalSummary(optionalSummary),
    });

    let response: CycleReviewResponse;
    try {
      response = await this.aiClient.generateJson(
        request,
        cycleReviewResponseSchema,
      );
    } catch (error) {
      throw mapAiError(error);
    }

    if (cycle.status === "ACTIVE") {
      const latestBeforeClose = await this.getCycle(userId, cycleId);
      if (
        latestBeforeClose.status !== "ACTIVE" ||
        reviewVersion === null ||
        getReviewVersion(latestBeforeClose) !== reviewVersion
      ) {
        throw new CycleReviewServiceError(
          "Workout data changed while the review was generating; please retry",
          "CONFLICT",
          409,
        );
      }

      try {
        await this.cycleService.close(userId, cycleId, now);
      } catch (error) {
        if (error instanceof CycleServiceError) {
          const latest = await this.getCycle(userId, cycleId);
          if (
            (error.code === "INVALID_STATE" || error.code === "CONFLICT") &&
            latest.status === "CLOSED" &&
            latest.reviewSnapshot
          ) {
            cycle = latest;
          } else {
            throw mapCycleError(error);
          }
        } else {
          throw error;
        }
      }
      cycle = await this.getCycle(userId, cycleId);
    }

    if (!cycle.reviewSnapshot) {
      throw new CycleReviewServiceError(
        "The closed cycle has no review snapshot",
        "INVALID_STATE",
        409,
      );
    }

    if (cycle.reviewSnapshot.processedSummary) {
      return toCycleReviewResult(
        cycle,
        buildObjectiveCycleSummary(toObjectiveInput(cycle)),
      );
    }

    // Persist the final post-close facts, rather than the projected input.
    objectiveSummary = buildObjectiveCycleSummary(toObjectiveInput(cycle));
    const conclusions = objectiveSummary.zeroCompletedCycle
      ? { ...response.conclusions, status: "RESET_REQUIRED" as const }
      : response.conclusions;
    const nextCycleDraft: {
      status: "PENDING" | "RESET_REQUIRED";
    } = {
      status: objectiveSummary.zeroCompletedCycle ? "RESET_REQUIRED" : "PENDING",
    };

    const updated = await this.prisma.cycleReviewSnapshot.updateMany({
      where: {
        id: cycle.reviewSnapshot.id,
        cycleId,
        processedSummary: null,
      },
      data: {
        processedSummary: response.processedSummary,
        objectiveSummary: toJsonValue(objectiveSummary),
        conclusions: toJsonValue(conclusions),
        nextCycleDraft: toJsonValue(nextCycleDraft),
      },
    });

    if (updated.count !== 1) {
      const latest = await this.getCycle(userId, cycleId);
      if (latest.reviewSnapshot?.processedSummary) {
        return toCycleReviewResult(
          latest,
          buildObjectiveCycleSummary(toObjectiveInput(latest)),
        );
      }
      throw new CycleReviewServiceError(
        "The cycle review changed while it was being saved",
        "CONFLICT",
        409,
      );
    }

    return {
      reviewId: cycle.reviewSnapshot.id,
      cycleId,
      cycleStatus: "CLOSED",
      objectiveSummary,
      processedSummary: response.processedSummary,
      conclusions,
      nextCycleEligibility: objectiveSummary.nextCycleEligibility,
      nextCycleDraftStatus: nextCycleDraft.status,
    };
  }

  async generateNextCycleDraft(
    userId: string,
    cycleId: string,
    reviewId: string,
    now = new Date(),
  ): Promise<NextCycleDraft> {
    const cycle = await this.getCycle(userId, cycleId);

    if (cycle.status !== "CLOSED" || !cycle.reviewSnapshot) {
      throw new CycleReviewServiceError(
        "A completed cycle review is required before generating the next draft",
        "INVALID_STATE",
        409,
      );
    }

    if (cycle.reviewSnapshot.id !== reviewId) {
      throw new CycleReviewServiceError(
        "The review does not belong to this cycle",
        "CONFLICT",
        409,
      );
    }

    const objectiveSummary = buildObjectiveCycleSummary(toObjectiveInput(cycle));
    const storedDraft = readStoredNextCycleDraft(cycle.reviewSnapshot.nextCycleDraft);

    if (storedDraft) {
      const persistedDraft = await this.prisma.trainingCycle.findFirst({
        where: { id: storedDraft.cycle.id, userId },
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          timezone: true,
          _count: { select: { workouts: true } },
        },
      });

      if (!persistedDraft) {
        throw new CycleReviewServiceError(
          "The stored next-cycle draft no longer exists",
          "CONFLICT",
          409,
        );
      }

      if (persistedDraft.status === "ACTIVE") {
        throw new CycleReviewServiceError(
          "The next-cycle draft has already been confirmed",
          "CONFLICT",
          409,
        );
      }

      if (
        persistedDraft.status !== "DRAFT" ||
        persistedDraft._count.workouts !== 0 ||
        !persistedDraft.timezone
      ) {
        throw new CycleReviewServiceError(
          "The stored next-cycle draft is not in a reviewable state",
          "CONFLICT",
          409,
        );
      }

      return {
        reviewId,
        cycle: {
          id: persistedDraft.id,
          status: "DRAFT",
          startDate: persistedDraft.startDate,
          endDate: persistedDraft.endDate,
          timezone: persistedDraft.timezone,
        },
        plan: storedDraft.plan,
      };
    }

    if (
      !cycle.reviewSnapshot.processedSummary ||
      objectiveSummary.nextCycleEligibility !== "ELIGIBLE"
    ) {
      throw new CycleReviewServiceError(
        "This cycle requires a reset before a next plan can be generated",
        "INVALID_STATE",
        409,
      );
    }

    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: {
        weeklyTrainingDays: true,
        sessionDurationMinutes: true,
        defaultLocation: true,
      },
    });

    if (!profile) {
      throw new CycleReviewServiceError(
        "The user profile is required before generating a next cycle",
        "INVALID_STATE",
        409,
      );
    }

    let draftCycle: NextCycleDraft["cycle"];
    try {
      draftCycle = await this.claimNextCycleDraft(
        userId,
        cycleId,
        reviewId,
        {
          weeklyTrainingDays: profile.weeklyTrainingDays,
          sessionDurationMinutes: profile.sessionDurationMinutes,
          defaultLocation: profile.defaultLocation as Location,
          timezone: cycle.timezone ?? "UTC",
        },
        now,
        cycle.reviewSnapshot.nextCycleDraft,
      );
    } catch (error) {
      if (error instanceof CycleServiceError) {
        throw mapCycleError(error);
      }
      throw error;
    }

    let plan: PlanDraft;
    try {
      plan = await this.planService.generateDraft(userId, draftCycle.id, {
        reviewContext: {
          objectiveSummary,
          processedSummary: cycle.reviewSnapshot.processedSummary,
          conclusions: cycle.reviewSnapshot.conclusions,
        },
      });
    } catch (error) {
      await this.releaseGeneratingDraft(userId, cycleId, reviewId, draftCycle.id);
      throw mapAiError(error);
    }

    const storedPayload = {
      status: "READY" as const,
      cycle: {
        ...draftCycle,
        startDate: draftCycle.startDate.toISOString(),
        endDate: draftCycle.endDate.toISOString(),
      },
      plan: toJsonValue(plan),
    };

    const updated = await this.prisma.cycleReviewSnapshot.updateMany({
      where: {
        id: reviewId,
        cycleId,
        nextCycleDraft: {
          path: ["status"],
          equals: "GENERATING",
        },
      },
      data: { nextCycleDraft: toJsonValue(storedPayload) },
    });

    if (updated.count !== 1) {
      const latest = await this.getCycle(userId, cycleId);
      const existing = latest.reviewSnapshot
        ? readStoredNextCycleDraft(latest.reviewSnapshot.nextCycleDraft)
        : null;
      if (existing) {
        return { reviewId, cycle: existing.cycle, plan: existing.plan };
      }
      throw new CycleReviewServiceError(
        "The next-cycle draft changed while it was being saved",
        "CONFLICT",
        409,
      );
    }

    return { reviewId, cycle: draftCycle, plan };
  }

  private async claimNextCycleDraft(
    userId: string,
    cycleId: string,
    reviewId: string,
    profile: {
      weeklyTrainingDays: number;
      sessionDurationMinutes: number;
      defaultLocation: Location;
      timezone: string;
    },
    now: Date,
    storedState: Prisma.JsonValue,
  ): Promise<NextCycleDraft["cycle"]> {
    const generating = readGeneratingNextCycleDraft(storedState);
    if (generating) {
      const existing = await this.prisma.trainingCycle.findFirst({
        where: {
          id: generating.cycleId,
          userId,
          status: "DRAFT",
        },
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          timezone: true,
          _count: { select: { workouts: true } },
        },
      });

      if (existing) {
        if (existing._count.workouts > 0 || !existing.timezone) {
          throw new CycleReviewServiceError(
            "The next-cycle draft is not in a recoverable state",
            "CONFLICT",
            409,
          );
        }

        return {
          id: existing.id,
          status: "DRAFT",
          startDate: existing.startDate,
          endDate: existing.endDate,
          timezone: existing.timezone,
        };
      }

      const reset = await this.prisma.cycleReviewSnapshot.updateMany({
        where: {
          id: reviewId,
          cycleId,
          nextCycleDraft: { path: ["status"], equals: "GENERATING" },
        },
        data: { nextCycleDraft: { status: "PENDING" } },
      });

      if (reset.count !== 1) {
        throw new CycleReviewServiceError(
          "The next-cycle draft changed while it was recovering",
          "CONFLICT",
          409,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const draft = await this.cycleService.createDraft(
        userId,
        profile,
        now,
        tx,
      );
      const claimed = await tx.cycleReviewSnapshot.updateMany({
        where: {
          id: reviewId,
          cycleId,
          nextCycleDraft: { path: ["status"], equals: "PENDING" },
        },
        data: {
          nextCycleDraft: toJsonValue({
            status: "GENERATING",
            cycleId: draft.id,
          }),
        },
      });

      if (claimed.count !== 1) {
        throw new CycleReviewServiceError(
          "The next-cycle draft changed while it was being claimed",
          "CONFLICT",
          409,
        );
      }

      return {
        id: draft.id,
        status: "DRAFT" as const,
        startDate: draft.startDate,
        endDate: draft.endDate,
        timezone: draft.timezone,
      };
    });
  }

  private async releaseGeneratingDraft(
    userId: string,
    cycleId: string,
    reviewId: string,
    draftCycleId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const released = await tx.cycleReviewSnapshot.updateMany({
        where: {
          id: reviewId,
          cycleId,
          nextCycleDraft: { path: ["status"], equals: "GENERATING" },
        },
        data: { nextCycleDraft: { status: "PENDING" } },
      });

      if (released.count === 1) {
        await tx.trainingCycle.deleteMany({
          where: { id: draftCycleId, userId, status: "DRAFT" },
        });
      }
    });
  }

  private async getCycle(
    userId: string,
    cycleId: string,
  ): Promise<CycleReviewRecord> {
    const cycle = await this.prisma.trainingCycle.findFirst({
      where: { id: cycleId, userId },
      select: cycleReviewSelect,
    });

    if (!cycle) {
      throw new CycleReviewServiceError(
        "Training cycle not found",
        "NOT_FOUND",
        404,
      );
    }

    return cycle;
  }
}

function toObjectiveInput(
  cycle: CycleReviewRecord,
  resolveUnresolved = false,
): ObjectiveCycleSummaryInput {
  return {
    cycleId: cycle.id,
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    workouts: cycle.workouts.map((workout) => ({
      id: workout.id,
      activityType: workout.activityType,
      status:
        resolveUnresolved && workout.status === "PLANNED"
          ? "CANCELLED"
          : workout.status,
      cancellationReason:
        resolveUnresolved && workout.status === "PLANNED"
          ? "AUTO_CYCLE_CLOSE"
          : workout.cancellationReason,
      durationMinutes: workout.durationMinutes,
      rescheduleCount: workout.rescheduleCount,
      plannedDetails: toDistanceDetails(workout.plannedDetails),
      actualDetails: toActualDetails(workout.workoutLog?.actualDetails),
      plannedExercises: workout.plannedExercises.map<ObjectivePlannedExerciseInput>(
        (exercise) => ({
          exerciseId: exercise.exerciseId,
          sets: exercise.plannedSets.map<ObjectivePlannedSet>((set) => ({
            setNumber: set.setNumber,
            targetReps: set.targetReps,
            plannedWeight: set.plannedWeight,
            weightUnit: toWeightUnit(set.weightUnit),
          })),
        }),
      ),
      actualExercises: (workout.workoutLog?.exerciseLogs ?? []).map<ObjectiveActualExerciseInput>(
        (exercise) => ({
          exerciseId: exercise.exerciseId,
          sets: exercise.setLogs.map<ObjectiveActualSet>((set) => ({
            setNumber: set.setNumber,
            actualReps: set.actualReps,
            actualWeight: set.actualWeight,
            weightUnit: toWeightUnit(set.weightUnit),
          })),
        }),
      ),
    })),
  };
}

function getReviewVersion(cycle: CycleReviewRecord): string {
  return JSON.stringify(
    cycle.workouts.map((workout) => ({
      id: workout.id,
      scheduledDate: workout.scheduledDate.toISOString(),
      status: workout.status,
      cancellationReason: workout.cancellationReason,
      completedAt: workout.completedAt?.toISOString() ?? null,
      updatedAt: workout.updatedAt.toISOString(),
      workoutLogUpdatedAt: workout.workoutLog?.updatedAt.toISOString() ?? null,
    })),
  );
}

function toDistanceDetails(value: Prisma.JsonValue | null):
  | { distanceKm?: number }
  | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const distanceKm = value.distanceKm;
  return typeof distanceKm === "number" ? { distanceKm } : {};
}

function toActualDetails(value: Prisma.JsonValue | null | undefined):
  | { actualDurationMinutes?: number; distanceKm?: number }
  | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return {
    ...(typeof value.actualDurationMinutes === "number"
      ? { actualDurationMinutes: value.actualDurationMinutes }
      : {}),
    ...(typeof value.distanceKm === "number"
      ? { distanceKm: value.distanceKm }
      : {}),
  };
}

function toWeightUnit(value: string | null): WeightUnit | null {
  return value === "KG" || value === "LB" ? value : null;
}

function normalizeOptionalSummary(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function toCycleReviewResult(
  cycle: CycleReviewRecord,
  objectiveSummary: ObjectiveCycleSummary,
): CycleReviewResult {
  if (!cycle.reviewSnapshot?.processedSummary) {
    throw new CycleReviewServiceError(
      "The cycle review is not complete",
      "INVALID_STATE",
      409,
    );
  }

  const conclusions = cycle.reviewSnapshot.conclusions as CycleReviewResponse["conclusions"];
  const nextCycleDraft = cycle.reviewSnapshot.nextCycleDraft as {
    status?: string;
  };

  return {
    reviewId: cycle.reviewSnapshot.id,
    cycleId: cycle.id,
    cycleStatus: "CLOSED",
    objectiveSummary,
    processedSummary: cycle.reviewSnapshot.processedSummary,
    conclusions,
    nextCycleEligibility: objectiveSummary.nextCycleEligibility,
    nextCycleDraftStatus:
      nextCycleDraft.status === "READY"
        ? "READY"
        : objectiveSummary.nextCycleEligibility === "RESET_REQUIRED"
          ? "RESET_REQUIRED"
          : "PENDING",
  };
}

function readStoredNextCycleDraft(value: Prisma.JsonValue | null | undefined): {
  cycle: NextCycleDraft["cycle"];
  plan: PlanDraft;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  if (value.status !== "READY" || !value.cycle || !value.plan) {
    return null;
  }

  if (
    typeof value.cycle !== "object" ||
    Array.isArray(value.cycle) ||
    typeof value.cycle.id !== "string" ||
    value.cycle.status !== "DRAFT" ||
    typeof value.cycle.startDate !== "string" ||
    typeof value.cycle.endDate !== "string" ||
    typeof value.cycle.timezone !== "string"
  ) {
    return null;
  }

  const plan = planDraftSchema.safeParse(value.plan);
  if (!plan.success) {
    return null;
  }

  return {
    cycle: {
      id: value.cycle.id,
      status: "DRAFT",
      startDate: new Date(value.cycle.startDate),
      endDate: new Date(value.cycle.endDate),
      timezone: value.cycle.timezone,
    },
    plan: plan.data,
  };
}

function readGeneratingNextCycleDraft(value: Prisma.JsonValue): {
  cycleId: string;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value.status === "GENERATING" && typeof value.cycleId === "string"
    ? { cycleId: value.cycleId }
    : null;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function mapAiError(error: unknown): CycleReviewServiceError {
  if (error instanceof AiClientError) {
    return new CycleReviewServiceError(
      error.message,
      "AI_ERROR",
      error.code === "NOT_CONFIGURED" ? 409 : 502,
    );
  }

  if (error instanceof PlanServiceError) {
    return new CycleReviewServiceError(
      error.message,
      error.code === "AI_ERROR" ? "AI_ERROR" : "CONFLICT",
      error.statusCode === 502 ? 502 : 409,
    );
  }

  return new CycleReviewServiceError(
    "AI cycle review failed",
    "AI_ERROR",
    502,
  );
}

function mapCycleError(error: CycleServiceError): CycleReviewServiceError {
  return new CycleReviewServiceError(
    error.message,
    error.code,
    error.statusCode,
  );
}
