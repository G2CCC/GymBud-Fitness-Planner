import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type {
  CardioWorkoutLogInput,
  SportWorkoutLogInput,
  StrengthWorkoutLogInput,
} from "@fitness/shared";
import {
  completeWorkout,
  getWorkout,
  listExercises,
  updateWorkoutLocation,
} from "../../api/client";
import type { ApiExercise, ApiWorkout } from "../../api/contracts";
import { CardioLogForm } from "../../components/workouts/CardioLogForm";
import { SportLogForm } from "../../components/workouts/SportLogForm";
import { StrengthLogForm } from "../../components/workouts/StrengthLogForm";
import {
  WorkoutEditor,
  type EditorExerciseOption,
  type WorkoutEditorSubmitPayload,
} from "../../components/workouts/WorkoutEditor";

type LogState =
  | StrengthWorkoutLogInput
  | CardioWorkoutLogInput
  | SportWorkoutLogInput;

function initialStrengthLog(workout: ApiWorkout): StrengthWorkoutLogInput {
  return {
    exercises: (workout.plannedExercises ?? []).map((exercise) => ({
      exerciseId: exercise.exerciseId,
      sortOrder: exercise.sortOrder,
      sets: exercise.plannedSets.map((set) => ({
        setNumber: set.setNumber,
        reps: set.targetReps,
        ...(set.plannedWeight === null ? {} : { weight: set.plannedWeight }),
        ...(set.weightUnit === null ? {} : { weightUnit: set.weightUnit }),
      })),
    })),
  };
}

export function WorkoutPage() {
  const { workoutId } = useParams<{ workoutId: string }>();
  const [workout, setWorkout] = useState<ApiWorkout | null>(null);
  const [exercises, setExercises] = useState<ApiExercise[]>([]);
  const [exerciseNames, setExerciseNames] = useState<Record<string, string>>({});
  const [backfill, setBackfill] = useState(false);
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
              ? { actualDurationMinutes: result.durationMinutes }
              : { actualDurationMinutes: result.durationMinutes },
        );
        if (result.activityType === "STRENGTH") {
          const availableExercises = await listExercises(result.location);
          setExercises(availableExercises);
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

  const legalExerciseOptions = useMemo<EditorExerciseOption[]>(
    () =>
      exercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        equipment: exercise.equipment,
        availableLocations: exercise.availableLocations,
      })),
    [exercises],
  );

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

  async function handleLocationChange(location: "GYM" | "HOME") {
    try {
      const updated = await updateWorkoutLocation(loadedWorkout.id, location);
      setWorkout(updated);
      if (updated.activityType === "STRENGTH") {
        const availableExercises = await listExercises(location);
        setExercises(availableExercises);
        setExerciseNames(
          Object.fromEntries(
            availableExercises.map((exercise) => [exercise.id, exercise.name]),
          ),
        );
      }
    } catch (locationError) {
      setError(
        locationError instanceof Error
          ? locationError.message
          : "The location could not be changed.",
      );
    }
  }

  async function handleSubmit(payload: WorkoutEditorSubmitPayload) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await completeWorkout(loadedWorkout.id, {
        ...(payload.completedAt ? { completedAt: payload.completedAt } : {}),
        log: loadedLog,
      });
      setWorkout(updated);
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
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link className="text-sm font-semibold text-gymbud-accent-strong" to="/calendar">
            ← Back to calendar
          </Link>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">
            {workout.activityType} · {workout.location}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gymbud-ink">
            Log your workout
          </h1>
        </div>
        {workout.status === "PLANNED" ? (
          <button
            className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-border px-4 text-sm font-semibold text-gymbud-ink"
            type="button"
            onClick={() => setBackfill((current) => !current)}
          >
            {backfill ? "Use current time" : "Backfill a completed session"}
          </button>
        ) : null}
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <section className="grid gap-4">
          {workout.status !== "PLANNED" ? (
            <p className="rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-5 text-sm text-gymbud-muted">
              This workout is {workout.status.toLowerCase()} and is kept as
              history. New workout logs are only accepted for planned sessions.
            </p>
          ) : workout.activityType === "STRENGTH" ? (
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
              onChange={(value) => setLog(value)}
            />
          ) : (
            <SportLogForm
              value={log as SportWorkoutLogInput}
              onChange={(value) => setLog(value)}
            />
          )}
        </section>

        <WorkoutEditor
          workout={workout}
          location={workout.location}
          legalExerciseOptions={legalExerciseOptions}
          saving={saving}
          mode={backfill ? "backfill" : "complete"}
          onLocationChange={(location) => void handleLocationChange(location)}
          onSubmit={(payload) => {
            if (!saving) {
              void handleSubmit(payload);
            }
          }}
        />
      </div>
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
