import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { WorkoutStatus } from "@fitness/shared";
import type { ApiWorkout } from "../../api/contracts";
import type { CalendarWorkout } from "./WorkoutCard";
import { WorkoutLogSummary } from "../workouts/WorkoutLogSummary";
import { ActivityIdentity } from "../catalog/ActivityIdentity";

export type WorkoutDetailsDrawerProps = {
  summary: CalendarWorkout;
  workout: ApiWorkout | null;
  loading: boolean;
  error: string | null;
  exerciseNames: Record<string, string>;
  onClose: () => void;
  onReschedule: (scheduledDate: string) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
};

const statusLabels: Record<WorkoutStatus, string> = {
  PLANNED: "Planned",
  COMPLETED: "Completed",
};

function dateKey(value: string): string {
  return value.slice(0, 10);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateKey(value) + "T12:00:00"));
}

function isOverdue(summary: CalendarWorkout): boolean {
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .filter((part) => part.type !== "literal")
    .reduce<Record<string, string>>((values, part) => {
      values[part.type] = part.value;
      return values;
    }, {});
  const todayKey = `${today.year}-${today.month}-${today.day}`;
  return summary.status === "PLANNED" && dateKey(summary.scheduledDate) < todayKey;
}

function statusClass(summary: CalendarWorkout): string {
  if (summary.status === "COMPLETED") {
    return "bg-gymbud-accent-soft text-gymbud-accent-strong";
  }
  return isOverdue(summary)
    ? "bg-gymbud-warning/10 text-gymbud-warning"
    : "bg-gymbud-accent-soft text-gymbud-accent-strong";
}

function plannedSetLabel(
  targetReps: number,
  plannedWeight: number | null,
  weightUnit: string | null,
): string {
  const weight =
    plannedWeight === null
      ? "bodyweight"
      : `${plannedWeight} ${weightUnit?.toLowerCase() ?? "kg"}`;
  return `${targetReps} reps · ${weight}`;
}

export function WorkoutDetailsDrawer({
  summary,
  workout,
  loading,
  error,
  exerciseNames,
  onClose,
  onReschedule,
  onDelete,
}: WorkoutDetailsDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const [scheduledDate, setScheduledDate] = useState(
    dateKey(summary.scheduledDate),
  );
  const [rescheduling, setRescheduling] = useState(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setScheduledDate(dateKey(summary.scheduledDate));
  }, [summary.id, summary.scheduledDate]);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [summary.id]);

  async function handleReschedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRescheduling(true);
    try {
      await onReschedule(scheduledDate);
    } finally {
      setRescheduling(false);
    }
  }

  const activityKey = summary.activityType.toLowerCase();
  const activityOption = summary.activityOption ?? workout?.activityOption;
  const actualDetails = workout?.workoutLog?.actualDetails ?? workout?.actualDetails;
  const legacyActivityName = actualDetails?.modality ?? actualDetails?.sportName;
  const actualDuration = actualDetails?.actualDurationMinutes;
  const facts: Array<{ label: string; value: string }> = [
    {
      label: actualDuration != null ? "Actual duration" : "Planned duration",
      value: (actualDuration ?? summary.durationMinutes) + " min",
    },
  ];

  if (summary.activityType === "STRENGTH" && workout) {
    const exerciseCount =
      summary.status === "COMPLETED"
        ? workout.workoutLog?.exerciseLogs.length ?? 0
        : workout.plannedExercises?.length ?? 0;
    facts.push({
      label: summary.status === "COMPLETED" ? "Exercises logged" : "Exercises",
      value: String(exerciseCount),
    });
  } else if (summary.activityType === "CARDIO" && actualDetails?.distanceKm != null) {
    facts.push({
      label: "Distance",
      value: actualDetails.distanceKm + " km",
    });
  } else if (summary.activityType === "SPORT" && actualDetails?.intensity) {
    facts.push({
      label: "Intensity",
      value: actualDetails.intensity.toLowerCase(),
    });
  }

  return (
    <div
      aria-label="Workout details overlay"
      className="fixed inset-0 z-40 bg-gymbud-ink/20"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="workout-details-title"
        tabIndex={-1}
        className="glass-surface fixed inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[var(--radius-card)] border border-gymbud-border p-5 shadow-2xl lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:w-full lg:max-w-md lg:rounded-none lg:rounded-l-[var(--radius-card)] lg:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">
              {formatDate(summary.scheduledDate)}
            </p>
            <h2
              id="workout-details-title"
              className="mt-2 text-2xl font-semibold tracking-tight text-gymbud-ink"
            >
              Workout details
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            className="focus-ring grid min-h-11 min-w-11 place-items-center rounded-full border border-gymbud-border text-xl text-gymbud-muted"
            type="button"
            aria-label="Close workout details"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="mt-6 grid gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`calendar-workout-card calendar-workout-card--${activityKey} rounded-full border px-3 py-1 text-sm font-semibold`}
            >
              <ActivityIdentity
                activityType={summary.activityType}
                activityOption={activityOption}
                fallbackName={legacyActivityName}
                size={18}
              />
            </span>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${statusClass(summary)}`}>
              {statusLabels[summary.status]}
            </span>
            {isOverdue(summary) ? (
              <span className="rounded-full bg-gymbud-warning/10 px-3 py-1 text-sm font-semibold text-gymbud-warning">
                Overdue
              </span>
            ) : null}
          </div>

          <div className={"grid gap-3 " + (facts.length > 1 ? "sm:grid-cols-2" : "")}>
            {facts.map((fact) => (
              <div
                className="rounded-[var(--radius-control)] bg-gymbud-surface-muted p-3"
                key={fact.label}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gymbud-muted">
                  {fact.label}
                </p>
                <p className="mt-1 text-lg font-semibold text-gymbud-ink">
                  {fact.value}
                </p>
              </div>
            ))}
          </div>

          {loading ? (
            <p className="rounded-[var(--radius-control)] bg-gymbud-surface-muted p-4 text-sm text-gymbud-muted" role="status">
              Loading the planned details…
            </p>
          ) : null}

          {error ? (
            <p className="rounded-[var(--radius-control)] bg-gymbud-danger/10 p-4 text-sm text-gymbud-danger" role="alert">
              {error}
            </p>
          ) : null}

          {workout?.status === "COMPLETED" ? (
            <WorkoutLogSummary
              workout={workout}
              exerciseNames={exerciseNames}
              compact
            />
          ) : workout?.activityType === "STRENGTH" ? (
            <section className="grid gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gymbud-ink">Planned exercises</h3>
                <p className="mt-1 text-xs text-gymbud-muted">
                  Planned set targets
                </p>
              </div>
              {workout.plannedExercises && workout.plannedExercises.length > 0 ? (
                <div className="grid gap-2">
                  {workout.plannedExercises.map((exercise) => (
                    <div
                      key={`${exercise.exerciseId}-${exercise.sortOrder}`}
                      className="rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface p-3"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-semibold text-gymbud-ink">
                          {exerciseNames[exercise.exerciseId] ?? "Planned exercise"}
                        </p>
                        <span className="shrink-0 text-xs text-gymbud-muted">
                          {exercise.plannedSets.length} sets
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {exercise.plannedSets.map((set) => (
                          <span
                            key={set.setNumber}
                            className="rounded-full bg-gymbud-surface-muted px-2.5 py-1 text-xs font-medium text-gymbud-muted"
                          >
                            {plannedSetLabel(set.targetReps, set.plannedWeight, set.weightUnit)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-[var(--radius-control)] bg-gymbud-surface-muted p-3 text-sm text-gymbud-muted">
                  No planned exercises were added.
                </p>
              )}
            </section>
          ) : null}

          {summary.status === "PLANNED" ? (
            <div className="grid gap-4 border-t border-gymbud-border pt-5">
              <form className="grid gap-2" onSubmit={(event) => void handleReschedule(event)}>
                <label className="grid gap-2 text-sm font-medium text-gymbud-ink">
                  Move this workout to
                  <input
                    className="min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
                    type="date"
                    value={scheduledDate}
                    onChange={(event) => setScheduledDate(event.target.value)}
                  />
                </label>
                <button
                  className="focus-ring min-h-11 rounded-[var(--radius-control)] bg-gymbud-accent-strong px-4 text-sm font-semibold text-white"
                  type="submit"
                  disabled={rescheduling}
                >
                  {rescheduling ? "Saving…" : "Save new date"}
                </button>
              </form>
              <button
                className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-danger px-4 text-sm font-semibold text-gymbud-danger"
                type="button"
                onClick={() => void onDelete()}
              >
                Delete planned workout
              </button>
            </div>
          ) : null}

          <Link
            className="button-primary focus-ring w-full"
            to={`/workouts/${summary.id}`}
          >
            {summary.status === "PLANNED" ? "Start workout" : "View workout summary"}
          </Link>
        </div>
      </aside>
    </div>
  );
}
