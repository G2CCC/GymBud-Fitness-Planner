import type {
  ActivityType,
  CancellationReason,
  CycleReviewStatus,
  CycleStatus,
  Location,
  WorkoutSource,
  WorkoutStatus,
  WeightUnit,
} from "@fitness/shared";

export type ApiProfile = {
  weeklyTrainingDays: number;
  sessionDurationMinutes: number;
  defaultLocation: Location;
  primaryGoal: string;
  secondaryOutcome?: string | null;
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
  location: Location;
  durationMinutes: number;
  status: WorkoutStatus;
  source: WorkoutSource;
  cancellationReason: CancellationReason | null;
  completedAt: string | null;
  rescheduleCount: number;
  plannedDetails?: unknown;
  plannedExercises?: ApiPlannedExercise[];
};

export type ApiCycle = {
  id: string;
  status: CycleStatus;
  startDate: string;
  endDate: string;
  timezone: string | null;
  reviewStatus: CycleReviewStatus | null;
  workouts: ApiWorkout[];
};

export type ApiExercise = {
  id: string;
  name: string;
  equipment: string | null;
  availableLocations: Location[];
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
  availableLocations: Location[];
};

export type ApiPlanDraftWorkout = {
  scheduledDate: string;
  activityType: ActivityType;
  location: Location;
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
  cycleStatus: "CLOSED";
  objectiveSummary: Record<string, unknown>;
  processedSummary: string;
  conclusions: {
    status: "CONTINUE" | "ADJUST_PLAN" | "RESET_REQUIRED";
    keyFindings: string[];
    recommendations: string[];
  };
  nextCycleEligibility: "ELIGIBLE" | "RESET_REQUIRED";
  nextCycleDraftStatus: "PENDING" | "RESET_REQUIRED" | "READY";
};

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
