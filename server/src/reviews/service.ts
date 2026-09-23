import { Prisma, PrismaClient } from "@prisma/client";
import {
  buildCycleTrainingVolume,
  compareCycleTrainingVolume,
  getNextWeeklyCycleStart,
  startOfLocalDate,
  type CycleTrainingVolume,
} from "@fitness/shared";
import { env } from "../config/env";
import { CycleService, CycleServiceError } from "../cycles/service";
import { PlanService, PlanServiceError } from "../ai/plan-service";
import { AiClientError, type AiClient } from "../ai/client";
import { cycleReviewResponseSchema, planDraftSchema, type CycleReviewResponse, type PlanDraft } from "../ai/schemas";
import { buildWeeklyReviewRequest, type PreviousCycleReviewContext } from "../ai/prompts/review";

const cycleReviewSelect = {
  id: true, userId: true, status: true, cycleNumber: true, startDate: true,
  endDate: true, timezone: true, updatedAt: true,
  reviewSnapshot: { select: { id: true, processedSummary: true, objectiveSummary: true, previousCycleSummary: true, conclusions: true, nextCycleDraft: true, reviewedAt: true } },
  workouts: { orderBy: { scheduledDate: "asc" }, select: {
    id: true, activityType: true, scheduledDate: true, status: true, completedAt: true, updatedAt: true,
    workoutLog: { select: { actualDetails: true, updatedAt: true, exerciseLogs: { orderBy: { sortOrder: "asc" }, select: { setLogs: { orderBy: { setNumber: "asc" }, select: { actualReps: true, actualWeight: true, weightUnit: true } } } } } },
  } },
} satisfies Prisma.TrainingCycleSelect;

type CycleReviewRecord = Prisma.TrainingCycleGetPayload<{ select: typeof cycleReviewSelect }>;

export type WeeklyReviewResult = {
  reviewId: string;
  cycleId: string;
  cycleNumber: number;
  cycleStatus: "CLOSED";
  trainingVolume: CycleTrainingVolume;
  previousCycle: PreviousCycleReviewContext | null;
  processedSummary: string;
  conclusions: CycleReviewResponse["conclusions"];
  nextCycleEligibility: "READY" | "RESET_REQUIRED";
  nextWeeklyDraftStatus: "NOT_AVAILABLE" | "PENDING" | "READY";
  nextWeeklyDraft: NextWeeklyDraft | null;
};

export type NextWeeklyDraft = {
  reviewId: string;
  cycle: { id: string; status: "DRAFT"; startDate: Date; endDate: Date; timezone: string };
  plan: PlanDraft;
};

export class CycleReviewServiceError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "CONFLICT" | "INVALID_STATE" | "AI_ERROR", readonly statusCode: 404 | 409 | 502) {
    super(message); this.name = "CycleReviewServiceError";
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

  async buildTrainingVolume(userId: string, cycleId: string): Promise<CycleTrainingVolume> {
    return buildCycleTrainingVolume(toTrainingVolumeInput(await this.getCycle(userId, cycleId)));
  }

  async processDueWeeklyCycle(userId: string, cycleId: string, now = new Date()): Promise<WeeklyReviewResult | null> {
    let cycle = await this.getCycle(userId, cycleId);
    if (cycle.status === "DRAFT") return null;
    if (cycle.status === "ACTIVE") {
      const reviewStatus = await this.cycleService.getReviewStatus(
        userId,
        cycleId,
        now,
      );
      if (!reviewStatus.reviewAvailable) return null;
      await this.generateWeeklyReview(userId, cycleId, now);
      cycle = await this.getCycle(userId, cycleId);
    }
    if (!cycle.reviewSnapshot?.processedSummary) return null;
    const stored = readStoredNextWeeklyDraft(cycle.reviewSnapshot.nextCycleDraft);
    if (!stored && buildCycleTrainingVolume(toTrainingVolumeInput(cycle)).completedWorkoutCount > 0) {
      await this.ensureNextWeeklyDraft(userId, cycleId, now);
      cycle = await this.getCycle(userId, cycleId);
    }
    return this.toWeeklyReviewResult(cycle);
  }

  async generateWeeklyReview(userId: string, cycleId: string, now = new Date()): Promise<WeeklyReviewResult> {
    let cycle = await this.getCycle(userId, cycleId);
    if (cycle.status === "DRAFT") throw new CycleReviewServiceError("Only an active or closed cycle can be reviewed", "INVALID_STATE", 409);
    if (cycle.reviewSnapshot?.processedSummary) return this.toWeeklyReviewResult(cycle);

    if (cycle.status === "ACTIVE") {
      const reviewStatus = await this.cycleService.getReviewStatus(
        userId,
        cycleId,
        now,
      );
      if (!reviewStatus.reviewAvailable) {
        throw new CycleReviewServiceError(
          reviewStatus.blockedReason === "PLANNED_WORKOUTS_REMAINING"
            ? "Complete or delete every planned workout before reviewing the cycle"
            : "The cycle review is not available until the cycle end date",
          "CONFLICT",
          409,
        );
      }
    }

    const volume = buildCycleTrainingVolume(toTrainingVolumeInput(cycle));
    const previous = await this.getPreviousCycleContext(userId, cycle);
    let response: CycleReviewResponse;
    try {
      response = await this.aiClient.generateJson(buildWeeklyReviewRequest({ model: this.model, cycleNumber: requireCycleNumber(cycle), trainingVolume: volume, previousCycle: previous ?? undefined }), cycleReviewResponseSchema);
    } catch (error) { throw mapAiError(error); }

    if (cycle.status === "ACTIVE") {
      try { await this.cycleService.close(userId, cycleId, now); }
      catch (error) { throw mapCycleError(error); }
      cycle = await this.getCycle(userId, cycleId);
    }
    if (!cycle.reviewSnapshot) throw new CycleReviewServiceError("The closed cycle has no review snapshot", "INVALID_STATE", 409);

    const finalVolume = buildCycleTrainingVolume(toTrainingVolumeInput(cycle));
    const finalPrevious = await this.getPreviousCycleContext(userId, cycle);
    const conclusions = finalVolume.completedWorkoutCount === 0 ? { ...response.conclusions, status: "RESET_REQUIRED" as const } : response.conclusions;
    await this.prisma.cycleReviewSnapshot.update({
      where: { id: cycle.reviewSnapshot.id },
      data: {
        processedSummary: response.processedSummary,
        objectiveSummary: toJsonValue(finalVolume),
        previousCycleSummary: finalPrevious ? toJsonValue(finalPrevious) : Prisma.JsonNull,
        conclusions: toJsonValue(conclusions),
        nextCycleDraft: toJsonValue({ status: finalVolume.completedWorkoutCount === 0 ? "NOT_AVAILABLE" : "PENDING" }),
        reviewedAt: now,
      },
    });
    return this.toWeeklyReviewResult(await this.getCycle(userId, cycleId));
  }

  async ensureNextWeeklyDraft(userId: string, cycleId: string, now = new Date()): Promise<NextWeeklyDraft | null> {
    const cycle = await this.getCycle(userId, cycleId);
    if (cycle.status !== "CLOSED" || !cycle.reviewSnapshot?.processedSummary) throw new CycleReviewServiceError("A completed weekly review is required before generating the next draft", "INVALID_STATE", 409);
    const volume = buildCycleTrainingVolume(toTrainingVolumeInput(cycle));
    if (volume.completedWorkoutCount === 0) return null;
    const stored = readStoredNextWeeklyDraft(cycle.reviewSnapshot.nextCycleDraft);
    if (stored) return { reviewId: cycle.reviewSnapshot.id, ...stored };

    const profile = await this.prisma.userProfile.findUnique({ where: { userId }, select: { weeklyTrainingDays: true, sessionDurationMinutes: true } });
    if (!profile) throw new CycleReviewServiceError("The user profile is required before generating a next week", "INVALID_STATE", 409);
    const timezone = cycle.timezone ?? "UTC";
    const startDate = getNextWeeklyCycleStart(cycle.endDate, startOfLocalDate(now, timezone));
    const draft = await this.cycleService.createDraft(userId, { weeklyTrainingDays: profile.weeklyTrainingDays, sessionDurationMinutes: profile.sessionDurationMinutes, timezone }, startDate);
    let plan: PlanDraft;
    try {
      plan = await this.planService.generateDraft(userId, draft.id, { reviewContext: { trainingVolume: volume, processedSummary: cycle.reviewSnapshot.processedSummary, conclusions: cycle.reviewSnapshot.conclusions } });
    } catch (error) {
      await this.prisma.trainingCycle.deleteMany({ where: { id: draft.id, userId, status: "DRAFT" } });
      throw mapAiError(error);
    }
    const payload = { status: "READY" as const, cycle: { id: draft.id, status: "DRAFT" as const, startDate: draft.startDate.toISOString(), endDate: draft.endDate.toISOString(), timezone: draft.timezone }, plan };
    await this.prisma.cycleReviewSnapshot.update({ where: { id: cycle.reviewSnapshot.id }, data: { nextCycleDraft: toJsonValue(payload) } });
    return { reviewId: cycle.reviewSnapshot.id, cycle: { id: draft.id, status: "DRAFT", startDate: draft.startDate, endDate: draft.endDate, timezone: draft.timezone }, plan };
  }

  async generateNextWeeklyDraft(userId: string, cycleId: string, reviewId: string, now = new Date()): Promise<NextWeeklyDraft> {
    const cycle = await this.getCycle(userId, cycleId);
    if (cycle.reviewSnapshot?.id !== reviewId) throw new CycleReviewServiceError("Weekly review not found", "NOT_FOUND", 404);
    const draft = await this.ensureNextWeeklyDraft(userId, cycleId, now);
    if (!draft) throw new CycleReviewServiceError("This week requires a reset before a next plan can be generated", "INVALID_STATE", 409);
    return draft;
  }

  private async getPreviousCycleContext(userId: string, cycle: CycleReviewRecord): Promise<PreviousCycleReviewContext | null> {
    if (cycle.cycleNumber === null || cycle.cycleNumber <= 1) return null;
    const previous = await this.prisma.trainingCycle.findFirst({ where: { userId, cycleNumber: cycle.cycleNumber - 1, status: "CLOSED", reviewSnapshot: { is: { processedSummary: { not: null } } } }, select: cycleReviewSelect });
    if (!previous || previous.cycleNumber === null) return null;
    const trainingVolume = buildCycleTrainingVolume(toTrainingVolumeInput(previous));
    const currentVolume = buildCycleTrainingVolume(toTrainingVolumeInput(cycle));
    return { cycleNumber: previous.cycleNumber, trainingVolume, comparison: compareCycleTrainingVolume(currentVolume, trainingVolume) };
  }

  private async getCycle(userId: string, cycleId: string): Promise<CycleReviewRecord> {
    const cycle = await this.prisma.trainingCycle.findFirst({ where: { id: cycleId, userId }, select: cycleReviewSelect });
    if (!cycle) throw new CycleReviewServiceError("Training cycle not found", "NOT_FOUND", 404);
    return cycle;
  }

  private toWeeklyReviewResult(cycle: CycleReviewRecord): WeeklyReviewResult {
    if (!cycle.reviewSnapshot?.processedSummary) throw new CycleReviewServiceError("The weekly review is not complete", "INVALID_STATE", 409);
    const volume = buildCycleTrainingVolume(toTrainingVolumeInput(cycle));
    const draft = readStoredNextWeeklyDraft(cycle.reviewSnapshot.nextCycleDraft);
    return {
      reviewId: cycle.reviewSnapshot.id,
      cycleId: cycle.id,
      cycleNumber: requireCycleNumber(cycle),
      cycleStatus: "CLOSED",
      trainingVolume: volume,
      previousCycle: cycle.reviewSnapshot.previousCycleSummary as PreviousCycleReviewContext | null,
      processedSummary: cycle.reviewSnapshot.processedSummary,
      conclusions: cycle.reviewSnapshot.conclusions as CycleReviewResponse["conclusions"],
      nextCycleEligibility: volume.completedWorkoutCount > 0 ? "READY" : "RESET_REQUIRED",
      nextWeeklyDraftStatus: volume.completedWorkoutCount === 0 ? "NOT_AVAILABLE" : draft ? "READY" : "PENDING",
      nextWeeklyDraft: draft ? { reviewId: cycle.reviewSnapshot.id, ...draft } : null,
    };
  }
}

function toTrainingVolumeInput(cycle: CycleReviewRecord): Parameters<typeof buildCycleTrainingVolume>[0] {
  return { cycleId: cycle.id, startDate: cycle.startDate, endDate: cycle.endDate, workouts: cycle.workouts.map((workout) => ({ id: workout.id, activityType: workout.activityType, status: workout.status, actualDetails: toActualDetails(workout.workoutLog?.actualDetails), actualExercises: (workout.workoutLog?.exerciseLogs ?? []).map((exercise) => ({ sets: exercise.setLogs.map((set) => ({ actualReps: set.actualReps, actualWeight: set.actualWeight, weightUnit: set.weightUnit })) })) })) };
}

function requireCycleNumber(cycle: Pick<CycleReviewRecord, "cycleNumber">): number {
  if (cycle.cycleNumber === null) throw new CycleReviewServiceError("The cycle number is missing", "INVALID_STATE", 409);
  return cycle.cycleNumber;
}

function readStoredNextWeeklyDraft(value: Prisma.JsonValue | null | undefined): Omit<NextWeeklyDraft, "reviewId"> | null {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.status !== "READY") return null;
  const cycle = value.cycle;
  if (!cycle || typeof cycle !== "object" || Array.isArray(cycle)) return null;
  if (typeof cycle.id !== "string" || cycle.status !== "DRAFT" || typeof cycle.startDate !== "string" || typeof cycle.endDate !== "string" || typeof cycle.timezone !== "string") return null;
  const plan = planDraftSchema.safeParse(value.plan);
  if (!plan.success) return null;
  return { cycle: { id: cycle.id, status: "DRAFT", startDate: new Date(cycle.startDate), endDate: new Date(cycle.endDate), timezone: cycle.timezone }, plan: plan.data };
}

function toActualDetails(value: Prisma.JsonValue | null | undefined): { actualDurationMinutes?: number; distanceKm?: number } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return { ...(typeof value.actualDurationMinutes === "number" ? { actualDurationMinutes: value.actualDurationMinutes } : {}), ...(typeof value.distanceKm === "number" ? { distanceKm: value.distanceKm } : {}) };
}

function toJsonValue(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
function mapAiError(error: unknown): CycleReviewServiceError {
  if (error instanceof CycleReviewServiceError) return error;
  if (error instanceof AiClientError) return new CycleReviewServiceError(error.message, "AI_ERROR", error.code === "NOT_CONFIGURED" ? 409 : 502);
  if (error instanceof PlanServiceError) return new CycleReviewServiceError(error.message, error.code === "AI_ERROR" ? "AI_ERROR" : "CONFLICT", error.statusCode === 502 ? 502 : 409);
  return new CycleReviewServiceError("AI weekly review failed", "AI_ERROR", 502);
}
function mapCycleError(error: unknown): CycleReviewServiceError {
  if (error instanceof CycleReviewServiceError) return error;
  if (error instanceof CycleServiceError) return new CycleReviewServiceError(error.message, error.code, error.statusCode);
  return new CycleReviewServiceError("Weekly cycle could not be closed", "CONFLICT", 409);
}
