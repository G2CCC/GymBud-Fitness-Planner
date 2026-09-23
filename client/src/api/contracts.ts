import type {
  ActivityType,
  CycleStatus,
  Gender,
  WorkoutStatus,
  WeightUnit,
} from "@fitness/shared";

export type ApiProfile = {
  weeklyTrainingDays: number;
  sessionDurationMinutes: number;
  primaryGoal: string;
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
};

export type ApiPlannedSet = {
  setNumber: number;
  targetReps: number;
  plannedWeight: number | null;
  weightUnit: WeightUnit | null;
};

export type ApiPlannedExercise = {
  exerciseId: string;
  sortOrder: number;
  restSeconds: number | null;
  plannedSets: ApiPlannedSet[];
};

export type ApiWorkout = {
  id: string;
  activityType: ActivityType;
  scheduledDate: string;
  durationMinutes: number;
  status: WorkoutStatus;
  completedAt: string | null;
  rescheduleCount: number;
  plannedDetails?: unknown;
  plannedExercises?: ApiPlannedExercise[];
  actualDetails?: {
    actualDurationMinutes?: number | null;
    distanceKm?: number | null;
  } | null;
  actualExercises?: Array<{
    exerciseId: string;
    sortOrder: number;
    sets: Array<{
      setNumber: number;
      actualReps: number;
      actualWeight: number;
      weightUnit: WeightUnit;
    }>;
  }>;
};

export type ApiCalendarWorkout = {
  id: string;
  cycleId: string;
  activityType: ActivityType;
  scheduledDate: string;
  durationMinutes: number;
  status: WorkoutStatus;
  completedAt: string | null;
  rescheduleCount: number;
};

export type ApiCycleReviewStatus = {
  reviewRequired: boolean;
  reviewAvailable: boolean;
  today: string;
  reviewAvailableOn: string;
  daysUntilReview: number;
  plannedWorkoutCount: number;
  blockedReason:
    | "BEFORE_REVIEW_DATE"
    | "PLANNED_WORKOUTS_REMAINING"
    | "CYCLE_NOT_ACTIVE"
    | null;
};

export type ApiCycle = {
  id: string;
  status: CycleStatus;
  cycleNumber: number | null;
  startDate: string;
  endDate: string;
  timezone: string | null;
  reviewStatus: ApiCycleReviewStatus | null;
  reviewAvailable: boolean;
  weeklyReview: ApiWeeklyReviewResult | null;
  workouts: ApiWorkout[];
};

export type ApiCycleDraft = {
  id: string;
  status: "DRAFT";
  startDate: string;
  endDate: string;
  timezone: string | null;
};

export type ApiActiveCycle = {
  id: string;
  status: "ACTIVE";
  cycleNumber: number;
  startDate: string;
  endDate: string;
  timezone: string;
  firstWeekDates: string[];
};

export type ApiExercise = {
  id: string;
  name: string;
  equipment: string | null;
};

export type ApiPlanDraftExercise = {
  exerciseId: string;
  sortOrder: number;
  restSeconds?: number;
  sets: Array<{
    setNumber: number;
    targetReps: number;
    plannedWeight?: number;
    weightUnit?: WeightUnit;
  }>;
  name: string;
  equipment: string | null;
};

export type ApiPlanDraftWorkout = {
  scheduledDate: string;
  activityType: ActivityType;
  durationMinutes: number;
  plannedDetails?: Record<string, unknown>;
  exercises: ApiPlanDraftExercise[];
};

export type ApiPlanDraft = {
  cycleId: string;
  model: string;
  promptVersion: string;
  workouts: ApiPlanDraftWorkout[];
};

export type ApiCycleReviewResult = {
  reviewId: string;
  cycleId: string;
  cycleNumber: number;
  cycleStatus: "CLOSED";
  trainingVolume: Record<string, unknown>;
  previousCycle: Record<string, unknown> | null;
  processedSummary: string;
  conclusions: {
    status: "CONTINUE" | "ADJUST_PLAN" | "RESET_REQUIRED";
    keyFindings: string[];
    recommendations: string[];
  };
  nextCycleEligibility: "READY" | "RESET_REQUIRED";
  nextWeeklyDraftStatus: "NOT_AVAILABLE" | "PENDING" | "READY";
  nextWeeklyDraft: ApiNextCycleDraft | null;
};

export type ApiWeeklyReviewResult = ApiCycleReviewResult;

export type ApiNextCycleDraft = {
  reviewId: string;
  cycle: {
    id: string;
    status: "DRAFT";
    startDate: string;
    endDate: string;
    timezone: string;
  };
  plan: ApiPlanDraft;
};
