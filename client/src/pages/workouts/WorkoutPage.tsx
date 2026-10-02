import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type {
  CardioWorkoutLogInput,
  SportWorkoutLogInput,
  StrengthWorkoutLogInput,
} from "@fitness/shared";
import {
  completeWorkout,
  saveWorkoutLog,
  getWorkout,
  listExercises,
} from "../../api/client";
import type { ApiWorkout } from "../../api/contracts";
import { CardioLogForm } from "../../components/workouts/CardioLogForm";
import { SportLogForm } from "../../components/workouts/SportLogForm";
import { ActivityIdentity } from "../../components/catalog/ActivityIdentity";
import { StrengthLogForm } from "../../components/workouts/StrengthLogForm";
import { WorkoutLogSummary } from "../../components/workouts/WorkoutLogSummary";
import {
  WorkoutEditor,
  type WorkoutEditorSubmitPayload,
} from "../../components/workouts/WorkoutEditor";

type LogState =
  | StrengthWorkoutLogInput
  | CardioWorkoutLogInput
  | SportWorkoutLogInput;

function formatScheduledDate(value: string): string {
  return new Intl.DateTimeFormat("en-NZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value.slice(0, 10) + "T12:00:00"));
}

function formatCompletedAt(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-NZ", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function initialStrengthLog(workout: ApiWorkout): StrengthWorkoutLogInput {
  if(workout.workoutLog?.exerciseLogs.length)return {exercises:workout.workoutLog.exerciseLogs.map(ex=>({exerciseId:ex.exerciseId,sortOrder:ex.sortOrder,sets:ex.setLogs.map(set=>({setNumber:set.setNumber,reps:set.actualReps,weight:set.actualWeight,weightUnit:set.weightUnit}))}))};
  return {
    exercises: (workout.plannedExercises ?? []).map((exercise) => ({
      exerciseId: exercise.exerciseId,
      sortOrder: exercise.sortOrder,
      sets: exercise.plannedSets.map((set) => ({
        setNumber: set.setNumber,
        reps: set.targetReps,
        weight: set.plannedWeight ?? 0,
        weightUnit: set.weightUnit ?? "KG",
      })),
    })),
  };
}

export function WorkoutPage() {
  const { workoutId } = useParams<{ workoutId: string }>();
  const [workout, setWorkout] = useState<ApiWorkout | null>(null);
  const [exerciseNames, setExerciseNames] = useState<Record<string, string>>({});
  const [backfill, setBackfill] = useState(false);
  const [editing, setEditing] = useState(false);
  const [log, setLog] = useState<LogState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!workoutId) {
      setError("This workout link is missing its id.");
      setLoading(false);
      return;
    }

    let active = true;
    void getWorkout(workoutId)
      .then(async (result) => {
        if (!active) {
          return;
        }
        setWorkout(result);
        setLog(
          result.activityType === "STRENGTH"
            ? initialStrengthLog(result)
            : result.activityType === "CARDIO"
              ? { ...result.workoutLog?.actualDetails, actualDurationMinutes: result.workoutLog?.actualDetails?.actualDurationMinutes ?? result.durationMinutes } as CardioWorkoutLogInput
              : { ...result.workoutLog?.actualDetails, actualDurationMinutes: result.workoutLog?.actualDetails?.actualDurationMinutes ?? result.durationMinutes } as SportWorkoutLogInput,
        );
        if (result.activityType === "STRENGTH") {
          const availableExercises = await listExercises();
          setExerciseNames(
            Object.fromEntries(
              availableExercises.map((exercise) => [exercise.id, exercise.name]),
            ),
          );
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "We could not load this workout.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [workoutId]);

  if (loading) {
    return <WorkoutMessage message="Loading workout details…" />;
  }

  if (!workout || !log || !workoutId) {
    return (
      <WorkoutMessage
        message={error ?? "This workout is not available."}
        isError
      />
    );
  }
  const loadedWorkout = workout;
  const loadedLog = log;

  async function handleSubmit(payload: WorkoutEditorSubmitPayload) {
    if (!loadedLog) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = loadedWorkout.status==='COMPLETED' && !payload.completedAt
        ? await saveWorkoutLog(loadedWorkout.id,loadedLog)
        : await completeWorkout(loadedWorkout.id, {
        ...(payload.completedAt ? { completedAt: payload.completedAt } : {}),
        log: loadedLog,
      });
      setWorkout(updated);
      setEditing(false);
      setSuccess(
        backfill
          ? "The actual completion date and time were saved."
          : "Workout completed and log saved.",
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The workout could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-4xl gap-5 px-4 py-6 sm:gap-6 sm:px-8">
      <header className="grid gap-4">
        <Link
          className="w-fit text-sm font-semibold text-gymbud-accent-strong"
          to="/calendar"
        >
          ← Back to calendar
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">
              <ActivityIdentity
                activityType={workout.activityType}
                activityOption={workout.activityOption}
                fallbackName={
                  workout.actualDetails?.modality ??
                  workout.actualDetails?.sportName
                }
                size={18}
              />
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gymbud-ink">
              {workout.status === "COMPLETED" ? "Workout summary" : "Log your workout"}
            </h1>
            <p className="mt-2 text-sm text-gymbud-muted">
              {workout.status === "COMPLETED"
                ? "Completed " + (formatCompletedAt(workout.completedAt) ?? formatScheduledDate(workout.scheduledDate))
                : "Planned for " + formatScheduledDate(workout.scheduledDate)}
            </p>
          </div>
          {workout.status === "PLANNED" || editing ? (
            <button
              className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-4 text-sm font-semibold text-gymbud-ink hover:bg-gymbud-surface-muted"
              type="button"
              onClick={() => setBackfill((current) => !current)}
            >
              {backfill ? "Use current time" : "Log a past workout"}
            </button>
          ) : (
            <span className="rounded-full bg-gymbud-success-soft px-3 py-1.5 text-sm font-semibold text-gymbud-success">
              Saved
            </span>
          )}
        </div>
      </header>

      {success ? (
        <p role="status" className="rounded-[var(--radius-control)] bg-gymbud-accent-soft p-3 text-sm text-gymbud-ink">
          {success}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-[var(--radius-control)] bg-gymbud-danger/10 p-3 text-sm text-gymbud-danger">
          {error}
        </p>
      ) : null}

      {workout.status === "PLANNED" || editing ? (
        <>
          <section
            aria-label="Workout overview"
            className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-4 shadow-sm"
          >
            <span className={"calendar-workout-card calendar-workout-card--" + workout.activityType.toLowerCase() + " rounded-full border px-3 py-1 text-sm font-semibold"}>
              <ActivityIdentity
                activityType={workout.activityType}
                activityOption={workout.activityOption}
                fallbackName={
                  workout.actualDetails?.modality ??
                  workout.actualDetails?.sportName
                }
                size={18}
              />
            </span>
            <span className="text-sm font-medium text-gymbud-ink">
              {workout.durationMinutes} min planned
            </span>
            <span className="text-sm text-gymbud-muted">
              {loadedWorkout.plannedExercises?.length ?? 0} {loadedWorkout.plannedExercises?.length === 1 ? "exercise" : "exercises"}
            </span>
          </section>

          <section aria-labelledby="workout-log-title" className="grid gap-4">
            <div>
              <h2 id="workout-log-title" className="text-lg font-semibold text-gymbud-ink">
                Your training
              </h2>
              <p className="mt-1 text-sm text-gymbud-muted">
                Enter the reps, weight, or session details you actually completed.
              </p>
            </div>
            {workout.activityType === "STRENGTH" ? (
              "exercises" in loadedLog && loadedLog.exercises.length > 0 ? (
                <StrengthLogForm
                  value={log as StrengthWorkoutLogInput}
                  plannedExercises={loadedWorkout.plannedExercises ?? []}
                  exerciseNames={exerciseNames}
                  onChange={(value) => setLog(value)}
                />
              ) : (
                <p className="rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-5 text-sm text-gymbud-muted">
                  This strength workout has no planned exercises to log yet.
                </p>
              )
            ) : workout.activityType === "CARDIO" ? (
              <CardioLogForm
                value={log as CardioWorkoutLogInput}
                activityOption={loadedWorkout.activityOption}
                legacyModality={loadedWorkout.actualDetails?.modality}
                onChange={(value) => setLog(value)}
              />
            ) : (
              <SportLogForm
                value={log as SportWorkoutLogInput}
                activityOption={loadedWorkout.activityOption}
                legacySportName={loadedWorkout.actualDetails?.sportName}
                onChange={(value) => setLog(value)}
              />
            )}
          </section>

          <WorkoutEditor
            workout={workout}
            saving={saving}
            mode={backfill ? "backfill" : "complete"}
            onSubmit={(payload) => {
              if (!saving) {
                void handleSubmit(payload);
              }
            }}
          />
        </>
      ) : (
        <>
          <section className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-4 shadow-sm">
            <span className={"calendar-workout-card calendar-workout-card--" + workout.activityType.toLowerCase() + " rounded-full border px-3 py-1 text-sm font-semibold"}>
              <ActivityIdentity
                activityType={workout.activityType}
                activityOption={workout.activityOption}
                fallbackName={
                  workout.actualDetails?.modality ??
                  workout.actualDetails?.sportName
                }
                size={18}
              />
            </span>
            <span className="text-sm text-gymbud-muted">
              Scheduled {formatScheduledDate(workout.scheduledDate)}
            </span>
          </section>
          <WorkoutLogSummary workout={workout} exerciseNames={exerciseNames} />
          <button type="button" className="button-primary focus-ring" onClick={()=>{setEditing(true);setBackfill(false);}}>Edit actual log</button>
        </>
      )}
    </main>
  );
}

function WorkoutMessage({
  message,
  isError = false,
}: {
  message: string;
  isError?: boolean;
}) {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-2xl content-center px-4 py-8">
      <p className={isError ? "text-gymbud-danger" : "text-gymbud-muted"}>
        {message}
      </p>
    </main>
  );
}
