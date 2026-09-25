import {
  validateCompletionTimestamp,
  type CardioWorkoutLogInput,
  type ActivityOptionType,
  type PlannedExerciseInput,
  type ProfileInput,
  type SportWorkoutLogInput,
  type StrengthWorkoutLogInput,
  type StrengthFocusArea,
} from "@fitness/shared";
import type {
  ApiCalendarWorkout,
  ApiCycle,
  ApiActiveCycle,
  ApiCycleReviewResult,
  ApiCycleDraft,
  ApiExercise,
  ApiActivityOption,
  ApiNextCycleDraft,
  ApiPlanDraft,
  ApiProfile,
  ApiWorkout,
} from "./contracts";
import {
  backfillCompletionInputSchema,
  clientPlanDraftSchema,
  createWorkoutInputSchema,
  profileInputSchema,
  rescheduleWorkoutInputSchema,
} from "./validation";
import { getAccessToken } from "../auth/client";

const apiBaseUrl = (
  import.meta.env.VITE_API_URL ?? "http://localhost:3000/api"
).replace(/\/$/, "");

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = "REQUEST_FAILED",
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const accessToken = await getAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) {
    headers.set("Authorization", "Bearer " + accessToken);
  }

  const response = await fetch(apiBaseUrl + path, {
    ...init,
    headers,
  });

  const body = (await response.json().catch(() => ({}))) as {
    data?: T;
    error?: { code?: string; message?: string };
  };

  if (!response.ok || body.error || !("data" in body)) {
    throw new ApiRequestError(
      body.error?.message ?? "The request could not be completed.",
      response.status,
      body.error?.code,
    );
  }

  return body.data as T;
}

function jsonBody(value: unknown): RequestInit {
  return { method: "POST", body: JSON.stringify(value) };
}

export async function getProfile(): Promise<ApiProfile | null> {
  return request<ApiProfile | null>("/profile");
}

export async function saveProfile(input: ProfileInput): Promise<ApiProfile> {
  const parsed = profileInputSchema.parse(input);
  return request<ApiProfile>("/profile", {
    method: "PUT",
    body: JSON.stringify(parsed),
  });
}

export async function getCurrentCycle(): Promise<ApiCycle | null> {
  const result = await request<{ cycle: ApiCycle | null }>("/cycles/current");
  return result.cycle;
}

export async function getCalendarWorkouts(
  from: string,
  to: string,
): Promise<ApiCalendarWorkout[]> {
  const params = new URLSearchParams({ from, to });
  const result = await request<{ workouts: ApiCalendarWorkout[] }>(
    "/calendar?" + params.toString(),
  );
  return result.workouts;
}

export async function createCycleDraft(
  profile: ProfileInput,
  timezone: string,
): Promise<ApiCycleDraft> {
  return request<ApiCycleDraft>("/cycles", {
    method: "POST",
    body: JSON.stringify({ ...profile, timezone }),
  });
}

export async function activateCycle(
  cycleId: string,
  timezone: string,
): Promise<ApiActiveCycle> {
  return request<ApiActiveCycle>(
    "/cycles/" + cycleId + "/activate",
    jsonBody({ timezone }),
  );
}

export async function generateInitialCyclePlan(
  cycleId: string,
): Promise<ApiPlanDraft> {
  return request<ApiPlanDraft>("/ai/plans/" + cycleId + "/generate", jsonBody({}));
}

export async function confirmInitialCyclePlan(
  cycleId: string,
  draft: ApiPlanDraft,
): Promise<unknown> {
  const parsed = clientPlanDraftSchema.parse(draft);
  return request("/ai/plans/" + cycleId + "/confirm", jsonBody(serializePlanDraft(parsed)));
}

export async function getWorkout(workoutId: string): Promise<ApiWorkout> {
  return request<ApiWorkout>("/workouts/" + workoutId);
}

export async function listExercises(
  focusArea?: StrengthFocusArea,
): Promise<ApiExercise[]> {
  const query = focusArea
    ? "?" + new URLSearchParams({ focusArea }).toString()
    : "";
  return request<ApiExercise[]>("/exercises" + query);
}

export async function listActivityOptions(
  activityType?: ActivityOptionType,
): Promise<ApiActivityOption[]> {
  const query = activityType
    ? "?" + new URLSearchParams({ activityType }).toString()
    : "";
  return request<ApiActivityOption[]>("/activity-options" + query);
}

export async function createWorkout(input: {
  activityType: "STRENGTH" | "CARDIO" | "SPORT";
  activityOptionId?: string;
  scheduledDate: string;
  durationMinutes: number;
  plannedDetails?: Record<string, unknown>;
  plannedExercises?: PlannedExerciseInput[];
}): Promise<ApiWorkout> {
  const parsed = createWorkoutInputSchema.parse({
    ...input,
    scheduledDate: new Date(input.scheduledDate),
  });
  return request<ApiWorkout>("/workouts", jsonBody({
    ...parsed,
    scheduledDate: parsed.scheduledDate.toISOString(),
  }));
}

export async function rescheduleWorkout(
  workoutId: string,
  scheduledDate: string,
): Promise<ApiWorkout> {
  const parsed = rescheduleWorkoutInputSchema.parse({
    scheduledDate: new Date(scheduledDate),
  });
  return request<ApiWorkout>(
    "/workouts/" + workoutId + "/reschedule",
    jsonBody({ scheduledDate: parsed.scheduledDate.toISOString() }),
  );
}

export async function deletePlannedWorkout(workoutId: string): Promise<void> {
  await request<{ id: string }>("/workouts/" + workoutId, { method: "DELETE" });
}

export type WorkoutLogInput =
  | StrengthWorkoutLogInput
  | CardioWorkoutLogInput
  | SportWorkoutLogInput;

export async function completeWorkout(
  workoutId: string,
  input: { completedAt?: string; log: WorkoutLogInput },
): Promise<ApiWorkout> {
  if (input.completedAt) {
    const completedAt = new Date(input.completedAt);
    validateCompletionTimestamp(completedAt, new Date());
  }

  return request<ApiWorkout>(
    "/workouts/" + workoutId + "/complete",
    jsonBody({
      ...input,
      ...(input.completedAt
        ? { completedAt: new Date(input.completedAt).toISOString() }
        : {}),
    }),
  );
}

export async function backfillWorkout(
  workoutId: string,
  completedAt: string,
): Promise<ApiWorkout> {
  const parsed = backfillCompletionInputSchema.parse({
    completedAt: new Date(completedAt),
  });
  validateCompletionTimestamp(parsed.completedAt, new Date());
  return request<ApiWorkout>(
    "/workouts/" + workoutId + "/backfill",
    jsonBody({ completedAt: parsed.completedAt.toISOString() }),
  );
}

export async function processWeeklyReview(
  cycleId: string,
): Promise<ApiCycleReviewResult | null> {
  return request<ApiCycleReviewResult>(
    "/cycles/" + cycleId + "/review",
    jsonBody({}),
  );
}

export async function generateNextCycleDraft(
  cycleId: string,
  reviewId: string,
): Promise<ApiNextCycleDraft> {
  return request<ApiNextCycleDraft>(
    "/cycles/" + cycleId + "/next-draft",
    jsonBody({ reviewId }),
  );
}

export async function confirmNextCyclePlan(
  cycleId: string,
  draft: ApiPlanDraft,
): Promise<unknown> {
  const parsed = clientPlanDraftSchema.parse(draft);
  return request(
    "/ai/plans/" + cycleId + "/confirm",
    jsonBody(serializePlanDraft(parsed)),
  );
}

export async function generateSingleDayPlan(
  cycleId: string,
  input: { scheduledDate: string; focusAreas: string[] },
): Promise<ApiPlanDraft> {
  const scheduledDate = new Date(input.scheduledDate);
  if (Number.isNaN(scheduledDate.getTime())) {
    throw new Error("Choose a valid plan date.");
  }

  return request<ApiPlanDraft>(
    "/ai/plans/" + cycleId + "/day-generate",
    jsonBody({
      scheduledDate: scheduledDate.toISOString(),
      focusAreas: input.focusAreas,
    }),
  );
}

export async function confirmSingleDayPlan(
  cycleId: string,
  draft: ApiPlanDraft,
): Promise<ApiWorkout> {
  const parsed = clientPlanDraftSchema.parse(draft);
  return request<ApiWorkout>(
    "/ai/plans/" + cycleId + "/day-confirm",
    jsonBody(serializePlanDraft(parsed)),
  );
}

function serializePlanDraft(
  draft: ReturnType<typeof clientPlanDraftSchema.parse>,
) {
  return {
    ...draft,
    workouts: draft.workouts.map((workout) => ({
      ...workout,
      scheduledDate: workout.scheduledDate.toISOString(),
    })),
  };
}
