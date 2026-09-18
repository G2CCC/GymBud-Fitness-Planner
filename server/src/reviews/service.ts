import {
  Prisma,
  PrismaClient,
  type CycleBatchReviewStatus as PrismaCycleBatchReviewStatus,
} from "@prisma/client";
import {
  aggregateCycleTrainingVolumes,
  buildCycleTrainingVolume,
  compareCycleTrainingVolume,
  getCycleBatchRange,
  isCycleBatchBoundary,
  type CycleBatchTrainingVolume,
  type CycleTrainingVolume,
  type CycleTrainingVolumeComparison,
} from "@fitness/shared";
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
import {
  buildCycleBatchReviewRequest,
  buildCycleReviewRequest,
  type PreviousCycleReviewContext,
} from "../ai/prompts/review";

const cycleReviewSelect = {
  id: true,
  userId: true,
  status: true,
  cycleNumber: true,
  startDate: true,
  endDate: true,
  timezone: true,
  updatedAt: true,
  reviewSnapshot: {
    select: {
      id: true,
      processedSummary: true,
      objectiveSummary: true,
      previousCycleSummary: true,
      conclusions: true,
      nextCycleDraft: true,
      reviewedAt: true,
    },
  },
  workouts: {
    orderBy: { scheduledDate: "asc" },
    select: {
      id: true,
      activityType: true,
      scheduledDate: true,
      status: true,
      completedAt: true,
      updatedAt: true,
      workoutLog: {
        select: {
          actualDetails: true,
          updatedAt: true,
          exerciseLogs: {
            orderBy: { sortOrder: "asc" },
            select: {
              setLogs: {
                orderBy: { setNumber: "asc" },
                select: {
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

const batchReviewSelect = {
  id: true,
  userId: true,
  startCycleNumber: true,
  endCycleNumber: true,
  status: true,
  processedSummary: true,
  objectiveSummary: true,
  conclusions: true,
  nextCycleDraft: true,
  reviewedAt: true,
} satisfies Prisma.CycleBatchReviewSelect;

type CycleReviewRecord = Prisma.TrainingCycleGetPayload<{
  select: typeof cycleReviewSelect;
}>;

type BatchReviewRecord = Prisma.CycleBatchReviewGetPayload<{
  select: typeof batchReviewSelect;
}>;

type BatchContext = {
  batchVolume: CycleBatchTrainingVolume;
  version: string;
};

export type CycleReviewResult = {
  reviewId: string;
  cycleId: string;
  cycleNumber: number;
  cycleStatus: "CLOSED";
  trainingVolume: CycleTrainingVolume;
  /** Kept as an API compatibility alias while clients migrate. */
  objectiveSummary: CycleTrainingVolume;
  previousCycle: PreviousCycleReviewContext | null;
  processedSummary: string;
  conclusions: CycleReviewResponse["conclusions"];
  nextCycleEligibility: "BATCH_REVIEW_REQUIRED" | "RESET_REQUIRED";
  nextCycleDraftStatus: "NOT_AVAILABLE";
  batchReview: {
    eligible: boolean;
    reviewId: string | null;
    status:
      | "NOT_ELIGIBLE"
      | "ELIGIBLE"
      | "GENERATING"
      | "READY"
      | "RESET_REQUIRED";
  };
};

export type CycleBatchReviewStatusResult = {
  eligible: boolean;
  reviewId: string | null;
  startCycleNumber: number | null;
  endCycleNumber: number | null;
  status:
    | "NOT_ELIGIBLE"
    | "ELIGIBLE"
    | "GENERATING"
    | "READY"
    | "RESET_REQUIRED";
};

export type CycleBatchReviewResult = {
  reviewId: string;
  startCycleNumber: number;
  endCycleNumber: number;
  batchVolume: CycleBatchTrainingVolume;
  processedSummary: string;
  conclusions: CycleReviewResponse["conclusions"];
  nextCycleDraftStatus: "PENDING" | "READY" | "RESET_REQUIRED";
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

  async buildTrainingVolume(
    userId: string,
    cycleId: string,
  ): Promise<CycleTrainingVolume> {
    const cycle = await this.getCycle(userId, cycleId);
    return buildCycleTrainingVolume(toTrainingVolumeInput(cycle));
  }

  async generateCycleReview(
    userId: string,
    cycleId: string,
    optionalSummary?: string,
    now = new Date(),
  ): Promise<CycleReviewResult> {
    await this.ensureCycleNumber(userId, cycleId);
    let cycle = await this.getCycle(userId, cycleId);

    if (cycle.status === "DRAFT") {
      throw new CycleReviewServiceError(
        "Only an active or closed cycle can be reviewed",
        "INVALID_STATE",
        409,
      );
    }

    if (cycle.reviewSnapshot?.processedSummary) {
      const batch = await this.ensureBatchReview(userId, cycle);
      return toCycleReviewResult(
        cycle,
        buildCycleTrainingVolume(toTrainingVolumeInput(cycle)),
        await this.getPreviousCycleContext(userId, cycle),
        batch,
      );
    }

    const cycleNumber = requireCycleNumber(cycle);
    let reviewVersion: string | null = null;
    if (cycle.status === "ACTIVE") {
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
      reviewVersion = getReviewVersion(cycle);
    }

    const trainingVolume = buildCycleTrainingVolume(
      toTrainingVolumeInput(cycle),
    );
    const previousCycle = await this.getPreviousCycleContext(userId, cycle);
    const request = buildCycleReviewRequest({
      model: this.model,
      cycleNumber,
      trainingVolume,
      previousCycle: previousCycle ?? undefined,
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
      const batch = await this.ensureBatchReview(userId, cycle);
      return toCycleReviewResult(
        cycle,
        buildCycleTrainingVolume(toTrainingVolumeInput(cycle)),
        await this.getPreviousCycleContext(userId, cycle),
        batch,
      );
    }

    const finalTrainingVolume = buildCycleTrainingVolume(
      toTrainingVolumeInput(cycle),
    );
    const finalPreviousCycle = await this.getPreviousCycleContext(userId, cycle);
    const conclusions =
      finalTrainingVolume.completedWorkoutCount === 0
        ? { ...response.conclusions, status: "RESET_REQUIRED" as const }
        : response.conclusions;

    const updated = await this.prisma.cycleReviewSnapshot.updateMany({
      where: {
        id: cycle.reviewSnapshot.id,
        cycleId,
        processedSummary: null,
      },
      data: {
        processedSummary: response.processedSummary,
        objectiveSummary: toJsonValue(finalTrainingVolume),
        previousCycleSummary: finalPreviousCycle
          ? toJsonValue(finalPreviousCycle)
          : Prisma.JsonNull,
        conclusions: toJsonValue(conclusions),
        nextCycleDraft: toJsonValue({ status: "NOT_AVAILABLE" }),
        reviewedAt: now,
      },
    });

    if (updated.count !== 1) {
      const latest = await this.getCycle(userId, cycleId);
      if (latest.reviewSnapshot?.processedSummary) {
        const batch = await this.ensureBatchReview(userId, latest);
        return toCycleReviewResult(
          latest,
          buildCycleTrainingVolume(toTrainingVolumeInput(latest)),
          await this.getPreviousCycleContext(userId, latest),
          batch,
        );
      }
      throw new CycleReviewServiceError(
        "The cycle review changed while it was being saved",
        "CONFLICT",
        409,
      );
    }

    cycle = await this.getCycle(userId, cycleId);
    const batch = await this.ensureBatchReview(userId, cycle);
    return toCycleReviewResult(
      cycle,
      finalTrainingVolume,
      finalPreviousCycle,
      batch,
    );
  }

  async getBatchReviewStatus(
    userId: string,
    cycleId: string,
  ): Promise<CycleBatchReviewStatusResult> {
    await this.ensureCycleNumber(userId, cycleId);
    const cycle = await this.getCycle(userId, cycleId);
    const cycleNumber = cycle.cycleNumber;

    if (cycle.status !== "CLOSED" || cycleNumber === null || !isCycleBatchBoundary(cycleNumber)) {
      return {
        eligible: false,
        reviewId: null,
        startCycleNumber: null,
        endCycleNumber: null,
        status: "NOT_ELIGIBLE",
      };
    }

    const batch = await this.ensureBatchReview(userId, cycle);
    if (!batch) {
      return {
        eligible: false,
        reviewId: null,
        ...getCycleBatchRange(cycleNumber),
        status: "NOT_ELIGIBLE",
      };
    }

    return {
      eligible: batch.status === "ELIGIBLE" || batch.status === "READY",
      reviewId: batch.id,
      startCycleNumber: batch.startCycleNumber,
      endCycleNumber: batch.endCycleNumber,
      status: toBatchStatus(batch.status),
    };
  }

  async generateBatchReview(
    userId: string,
    cycleId: string,
    optionalSummary?: string,
    now = new Date(),
  ): Promise<CycleBatchReviewResult> {
    await this.ensureCycleNumber(userId, cycleId);
    const cycle = await this.getCycle(userId, cycleId);
    const cycleNumber = requireCycleNumber(cycle);

    if (cycle.status !== "CLOSED" || !isCycleBatchBoundary(cycleNumber)) {
      throw new CycleReviewServiceError(
        "A four-cycle review is only available after a completed batch",
        "INVALID_STATE",
        409,
      );
    }

    const batch = await this.ensureBatchReview(userId, cycle);
    if (!batch) {
      throw new CycleReviewServiceError(
        "The four cycles in this batch must all be closed before review",
        "INVALID_STATE",
        409,
      );
    }

    if (batch.processedSummary) {
      const context = await this.requireBatchContext(userId, cycleNumber);
      return toBatchReviewResult(batch, context.batchVolume);
    }

    const claimed = await this.prisma.cycleBatchReview.updateMany({
      where: { id: batch.id, status: "ELIGIBLE" },
      data: { status: "GENERATING" },
    });

    if (claimed.count !== 1) {
      const latest = await this.getBatchReview(batch.id);
      if (latest?.processedSummary) {
        const context = await this.requireBatchContext(userId, cycleNumber);
        return toBatchReviewResult(latest, context.batchVolume);
      }
      throw new CycleReviewServiceError(
        "The four-cycle review is already being generated",
        "CONFLICT",
        409,
      );
    }

    try {
      const context = await this.requireBatchContext(userId, cycleNumber);
      const request = buildCycleBatchReviewRequest({
        model: this.model,
        startCycleNumber: context.batchVolume.startCycleNumber,
        endCycleNumber: context.batchVolume.endCycleNumber,
        cycleVolumes: context.batchVolume.cycles,
        optionalUserSummary: normalizeOptionalSummary(optionalSummary),
      });
      const response = await this.aiClient.generateJson(
        request,
        cycleReviewResponseSchema,
      );
      const latestContext = await this.requireBatchContext(userId, cycleNumber);

      if (latestContext.version !== context.version) {
        throw new CycleReviewServiceError(
          "Workout data changed while the four-cycle review was generating; please retry",
          "CONFLICT",
          409,
        );
      }

      const conclusions =
        latestContext.batchVolume.aggregate.completedWorkoutCount === 0
          ? { ...response.conclusions, status: "RESET_REQUIRED" as const }
          : response.conclusions;
      const status =
        conclusions.status === "RESET_REQUIRED" ? "RESET_REQUIRED" : "READY";
      const updated = await this.prisma.cycleBatchReview.updateMany({
        where: { id: batch.id, status: "GENERATING" },
        data: {
          status,
          processedSummary: response.processedSummary,
          objectiveSummary: toJsonValue(latestContext.batchVolume),
          conclusions: toJsonValue(conclusions),
          reviewedAt: now,
        },
      });

      if (updated.count !== 1) {
        throw new CycleReviewServiceError(
          "The four-cycle review changed while it was being saved",
          "CONFLICT",
          409,
        );
      }

      const saved = await this.getBatchReview(batch.id);
      if (!saved) {
        throw new CycleReviewServiceError(
          "The four-cycle review could not be reloaded",
          "CONFLICT",
          409,
        );
      }
      return toBatchReviewResult(saved, latestContext.batchVolume);
    } catch (error) {
      await this.prisma.cycleBatchReview.updateMany({
        where: { id: batch.id, status: "GENERATING" },
        data: { status: "ELIGIBLE" },
      });
      if (error instanceof CycleReviewServiceError) {
        throw error;
      }
      throw mapAiError(error);
    }
  }

  async generateBatchNextCycleDraft(
    userId: string,
    cycleId: string,
    reviewId: string,
    now = new Date(),
  ): Promise<NextCycleDraft> {
    await this.ensureCycleNumber(userId, cycleId);
    const cycle = await this.getCycle(userId, cycleId);
    const cycleNumber = requireCycleNumber(cycle);
    if (cycle.status !== "CLOSED" || !isCycleBatchBoundary(cycleNumber)) {
      throw new CycleReviewServiceError(
        "A next-cycle draft is only available after a completed four-cycle batch",
        "INVALID_STATE",
        409,
      );
    }
    const range = getCycleBatchRange(cycleNumber);
    const batch = await this.prisma.cycleBatchReview.findUnique({
      where: {
        userId_startCycleNumber_endCycleNumber: {
          userId,
          startCycleNumber: range.startCycleNumber,
          endCycleNumber: range.endCycleNumber,
        },
      },
      select: batchReviewSelect,
    });

    if (!batch || batch.id !== reviewId || !batch.processedSummary) {
      throw new CycleReviewServiceError(
        "A completed four-cycle review is required before generating the next draft",
        "INVALID_STATE",
        409,
      );
    }

    if (batch.status === "RESET_REQUIRED") {
      throw new CycleReviewServiceError(
        "This four-cycle review requires a reset before a next plan can be generated",
        "INVALID_STATE",
        409,
      );
    }

    const storedDraft = readStoredNextCycleDraft(batch.nextCycleDraft);
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

    if (batch.status !== "READY") {
      throw new CycleReviewServiceError(
        "The four-cycle review is not ready for plan generation",
        "INVALID_STATE",
        409,
      );
    }

    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: {
        weeklyTrainingDays: true,
        sessionDurationMinutes: true,
      },
    });

    if (!profile) {
      throw new CycleReviewServiceError(
        "The user profile is required before generating a next cycle",
        "INVALID_STATE",
        409,
      );
    }

    const context = await this.requireBatchContext(userId, cycleNumber);
    let draftCycle: NextCycleDraft["cycle"];
    try {
      draftCycle = await this.claimBatchDraft(
        userId,
        batch.id,
        {
          weeklyTrainingDays: profile.weeklyTrainingDays,
          sessionDurationMinutes: profile.sessionDurationMinutes,
          timezone: cycle.timezone ?? "UTC",
        },
        now,
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
          trainingVolume: context.batchVolume.aggregate,
          processedSummary: batch.processedSummary,
          conclusions: batch.conclusions,
        },
      });
    } catch (error) {
      await this.releaseBatchDraft(userId, batch.id, draftCycle.id);
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

    const updated = await this.prisma.cycleBatchReview.updateMany({
      where: {
        id: batch.id,
        status: "READY",
        nextCycleDraft: {
          path: ["status"],
          equals: "GENERATING",
        },
      },
      data: { nextCycleDraft: toJsonValue(storedPayload) },
    });

    if (updated.count !== 1) {
      const latest = await this.getBatchReview(batch.id);
      const existing = latest
        ? readStoredNextCycleDraft(latest.nextCycleDraft)
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

  /**
   * Compatibility entry point for clients that still call /next-draft.
   * It now only succeeds for the fixed four-cycle boundary.
   */
  async generateNextCycleDraft(
    userId: string,
    cycleId: string,
    reviewId: string,
    now = new Date(),
  ): Promise<NextCycleDraft> {
    return this.generateBatchNextCycleDraft(userId, cycleId, reviewId, now);
  }

  private async claimBatchDraft(
    userId: string,
    batchId: string,
    profile: {
      weeklyTrainingDays: number;
      sessionDurationMinutes: number;
      timezone: string;
    },
    now: Date,
  ): Promise<NextCycleDraft["cycle"]> {
    const existingBatch = await this.getBatchReview(batchId);
    const generating = existingBatch
      ? readGeneratingNextCycleDraft(existingBatch.nextCycleDraft)
      : null;

    if (generating?.cycleId) {
      const existing = await this.prisma.trainingCycle.findFirst({
        where: { id: generating.cycleId, userId, status: "DRAFT" },
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          timezone: true,
          _count: { select: { workouts: true } },
        },
      });

      if (existing && existing._count.workouts === 0 && existing.timezone) {
        return {
          id: existing.id,
          status: "DRAFT",
          startDate: existing.startDate,
          endDate: existing.endDate,
          timezone: existing.timezone,
        };
      }
    }

    if (generating) {
      await this.prisma.cycleBatchReview.updateMany({
        where: {
          id: batchId,
          nextCycleDraft: { path: ["status"], equals: "GENERATING" },
        },
        data: { nextCycleDraft: Prisma.JsonNull },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.cycleBatchReview.updateMany({
        where: {
          id: batchId,
          status: "READY",
          nextCycleDraft: { equals: Prisma.JsonNull },
        },
        data: { nextCycleDraft: { status: "GENERATING" } },
      });

      if (claimed.count !== 1) {
        throw new CycleReviewServiceError(
          "The next-cycle draft is already being generated",
          "CONFLICT",
          409,
        );
      }

      const draft = await this.cycleService.createDraft(
        userId,
        profile,
        now,
        tx,
      );
      const linked = await tx.cycleBatchReview.updateMany({
        where: {
          id: batchId,
          nextCycleDraft: { path: ["status"], equals: "GENERATING" },
        },
        data: {
          nextCycleDraft: toJsonValue({
            status: "GENERATING",
            cycleId: draft.id,
          }),
        },
      });

      if (linked.count !== 1) {
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
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  private async releaseBatchDraft(
    userId: string,
    batchId: string,
    draftCycleId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const released = await tx.cycleBatchReview.updateMany({
        where: {
          id: batchId,
          nextCycleDraft: { path: ["status"], equals: "GENERATING" },
        },
        data: { nextCycleDraft: Prisma.JsonNull },
      });

      if (released.count === 1) {
        await tx.trainingCycle.deleteMany({
          where: { id: draftCycleId, userId, status: "DRAFT" },
        });
      }
    });
  }

  private async ensureCycleNumber(
    userId: string,
    cycleId: string,
  ): Promise<number> {
    const cycle = await this.prisma.trainingCycle.findFirst({
      where: { id: cycleId, userId },
      select: { status: true, cycleNumber: true },
    });

    if (!cycle) {
      throw new CycleReviewServiceError(
        "Training cycle not found",
        "NOT_FOUND",
        404,
      );
    }

    if (cycle.status === "DRAFT") {
      throw new CycleReviewServiceError(
        "Only an active or closed cycle can be reviewed",
        "INVALID_STATE",
        409,
      );
    }

    if (cycle.cycleNumber !== null) {
      return cycle.cycleNumber;
    }

    const highestCycle = await this.prisma.trainingCycle.aggregate({
      where: { userId, cycleNumber: { not: null } },
      _max: { cycleNumber: true },
    });
    const cycleNumber = (highestCycle._max.cycleNumber ?? 0) + 1;
    const updated = await this.prisma.trainingCycle.updateMany({
      where: { id: cycleId, userId, cycleNumber: null },
      data: { cycleNumber },
    });

    if (updated.count !== 1) {
      const current = await this.prisma.trainingCycle.findFirst({
        where: { id: cycleId, userId },
        select: { cycleNumber: true },
      });
      if (current?.cycleNumber !== null && current?.cycleNumber !== undefined) {
        return current.cycleNumber;
      }
      throw new CycleReviewServiceError(
        "The cycle number changed while it was being assigned",
        "CONFLICT",
        409,
      );
    }

    return cycleNumber;
  }

  private async ensureBatchReview(
    userId: string,
    cycle: CycleReviewRecord,
  ): Promise<BatchReviewRecord | null> {
    if (
      cycle.status !== "CLOSED" ||
      cycle.cycleNumber === null ||
      !isCycleBatchBoundary(cycle.cycleNumber)
    ) {
      return null;
    }

    const context = await this.getBatchContext(userId, cycle.cycleNumber);
    if (!context) {
      return null;
    }

    const range = getCycleBatchRange(cycle.cycleNumber);
    const existing = await this.prisma.cycleBatchReview.findUnique({
      where: {
        userId_startCycleNumber_endCycleNumber: {
          userId,
          startCycleNumber: range.startCycleNumber,
          endCycleNumber: range.endCycleNumber,
        },
      },
      select: batchReviewSelect,
    });

    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.cycleBatchReview.create({
        data: {
          userId,
          startCycleNumber: range.startCycleNumber,
          endCycleNumber: range.endCycleNumber,
          status: "ELIGIBLE",
          objectiveSummary: toJsonValue(context.batchVolume),
        },
        select: batchReviewSelect,
      });
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        const concurrent = await this.prisma.cycleBatchReview.findUnique({
          where: {
            userId_startCycleNumber_endCycleNumber: {
              userId,
              startCycleNumber: range.startCycleNumber,
              endCycleNumber: range.endCycleNumber,
            },
          },
          select: batchReviewSelect,
        });
        if (concurrent) {
          return concurrent;
        }
      }
      throw error;
    }
  }

  private async requireBatchContext(
    userId: string,
    endCycleNumber: number,
  ): Promise<BatchContext> {
    const context = await this.getBatchContext(userId, endCycleNumber);
    if (!context) {
      throw new CycleReviewServiceError(
        "The four cycles in this batch must all be closed before review",
        "INVALID_STATE",
        409,
      );
    }
    return context;
  }

  private async getBatchContext(
    userId: string,
    endCycleNumber: number,
  ): Promise<BatchContext | null> {
    const range = getCycleBatchRange(endCycleNumber);
    const cycles = await this.prisma.trainingCycle.findMany({
      where: {
        userId,
        cycleNumber: {
          gte: range.startCycleNumber,
          lte: range.endCycleNumber,
        },
      },
      orderBy: { cycleNumber: "asc" },
      select: cycleReviewSelect,
    });

    if (
      cycles.length !== 4 ||
      cycles.some(
        (cycle) =>
          cycle.status !== "CLOSED" ||
          cycle.cycleNumber === null ||
          cycle.cycleNumber < range.startCycleNumber ||
          cycle.cycleNumber > range.endCycleNumber,
      )
    ) {
      return null;
    }

    const batchVolume = aggregateCycleTrainingVolumes({
      startCycleNumber: range.startCycleNumber,
      endCycleNumber: range.endCycleNumber,
      cycles: cycles.map((cycle) => ({
        cycleNumber: requireCycleNumber(cycle),
        trainingVolume: buildCycleTrainingVolume(toTrainingVolumeInput(cycle)),
      })),
    });

    return {
      batchVolume,
      version: cycles.map(getReviewVersion).join("|")
    };
  }

  private async getPreviousCycleContext(
    userId: string,
    cycle: CycleReviewRecord,
  ): Promise<PreviousCycleReviewContext | null> {
    if (cycle.cycleNumber === null || cycle.cycleNumber <= 1) {
      return null;
    }

    const previous = await this.prisma.trainingCycle.findFirst({
      where: {
        userId,
        cycleNumber: cycle.cycleNumber - 1,
        status: "CLOSED",
        reviewSnapshot: { is: { processedSummary: { not: null } } },
      },
      select: cycleReviewSelect,
    });

    if (!previous || previous.cycleNumber === null) {
      return null;
    }

    const trainingVolume = buildCycleTrainingVolume(
      toTrainingVolumeInput(previous),
    );
    const currentVolume = buildCycleTrainingVolume(toTrainingVolumeInput(cycle));
    const comparison: CycleTrainingVolumeComparison =
      compareCycleTrainingVolume(currentVolume, trainingVolume);

    return {
      cycleNumber: previous.cycleNumber,
      trainingVolume,
      comparison,
    };
  }

  private async getBatchReview(id: string): Promise<BatchReviewRecord | null> {
    return this.prisma.cycleBatchReview.findUnique({
      where: { id },
      select: batchReviewSelect,
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

function toTrainingVolumeInput(
  cycle: CycleReviewRecord,
): Parameters<typeof buildCycleTrainingVolume>[0] {
  return {
    cycleId: cycle.id,
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    workouts: cycle.workouts.map((workout) => ({
      id: workout.id,
      activityType: workout.activityType,
      status: workout.status,
      actualDetails: toActualDetails(workout.workoutLog?.actualDetails),
      actualExercises: (workout.workoutLog?.exerciseLogs ?? []).map(
        (exercise) => ({
          sets: exercise.setLogs.map((set) => ({
            actualReps: set.actualReps,
            actualWeight: set.actualWeight,
            weightUnit: set.weightUnit,
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
      completedAt: workout.completedAt?.toISOString() ?? null,
      updatedAt: workout.updatedAt.toISOString(),
      workoutLogUpdatedAt: workout.workoutLog?.updatedAt.toISOString() ?? null,
    })),
  );
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

function normalizeOptionalSummary(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function requireCycleNumber(cycle: Pick<CycleReviewRecord, "cycleNumber">): number {
  if (cycle.cycleNumber === null) {
    throw new CycleReviewServiceError(
      "The cycle number is missing; please run the cycle migration",
      "INVALID_STATE",
      409,
    );
  }
  return cycle.cycleNumber;
}

function toCycleReviewResult(
  cycle: CycleReviewRecord,
  trainingVolume: CycleTrainingVolume,
  previousCycle: PreviousCycleReviewContext | null,
  batch: BatchReviewRecord | null,
): CycleReviewResult {
  if (!cycle.reviewSnapshot?.processedSummary) {
    throw new CycleReviewServiceError(
      "The cycle review is not complete",
      "INVALID_STATE",
      409,
    );
  }

  const cycleNumber = requireCycleNumber(cycle);
  const conclusions = cycle.reviewSnapshot.conclusions as CycleReviewResponse["conclusions"];

  return {
    reviewId: cycle.reviewSnapshot.id,
    cycleId: cycle.id,
    cycleNumber,
    cycleStatus: "CLOSED",
    trainingVolume,
    objectiveSummary: trainingVolume,
    previousCycle,
    processedSummary: cycle.reviewSnapshot.processedSummary,
    conclusions,
    nextCycleEligibility:
      trainingVolume.completedWorkoutCount > 0
        ? "BATCH_REVIEW_REQUIRED"
        : "RESET_REQUIRED",
    nextCycleDraftStatus: "NOT_AVAILABLE",
    batchReview: {
      eligible: batch
        ? batch.status === "ELIGIBLE" || batch.status === "READY"
        : false,
      reviewId: batch?.id ?? null,
      status: batch ? toBatchStatus(batch.status) : "NOT_ELIGIBLE",
    },
  };
}

function toBatchReviewResult(
  batch: BatchReviewRecord,
  batchVolume: CycleBatchTrainingVolume,
): CycleBatchReviewResult {
  if (!batch.processedSummary || !batch.conclusions) {
    throw new CycleReviewServiceError(
      "The four-cycle review is not complete",
      "INVALID_STATE",
      409,
    );
  }

  const nextDraft = readStoredNextCycleDraft(batch.nextCycleDraft);
  return {
    reviewId: batch.id,
    startCycleNumber: batch.startCycleNumber,
    endCycleNumber: batch.endCycleNumber,
    batchVolume,
    processedSummary: batch.processedSummary,
    conclusions: batch.conclusions as CycleReviewResponse["conclusions"],
    nextCycleDraftStatus:
      batch.status === "RESET_REQUIRED"
        ? "RESET_REQUIRED"
        : nextDraft
          ? "READY"
          : "PENDING",
  };
}

function toBatchStatus(
  status: PrismaCycleBatchReviewStatus,
): CycleBatchReviewStatusResult["status"] {
  return status === "CONFIRMED" ? "READY" : status;
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

function readGeneratingNextCycleDraft(value: Prisma.JsonValue | null | undefined): {
  cycleId?: string;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value.status === "GENERATING"
    ? {
        ...(typeof value.cycleId === "string" ? { cycleId: value.cycleId } : {}),
      }
    : null;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isPrismaUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function mapAiError(error: unknown): CycleReviewServiceError {
  if (error instanceof CycleReviewServiceError) {
    return error;
  }

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
