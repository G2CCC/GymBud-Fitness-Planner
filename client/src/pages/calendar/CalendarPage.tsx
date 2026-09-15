import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ActivityType, Location } from "@fitness/shared";
import {
  cancelWorkout,
  createWorkout,
  getCurrentCycle,
  rescheduleWorkout,
  updateWorkoutLocation,
} from "../../api/client";
import type { ApiCycle } from "../../api/contracts";
import { CalendarGrid } from "../../components/calendar/CalendarGrid";
import { WorkoutCard, type CalendarWorkout } from "../../components/calendar/WorkoutCard";
import { LocationSelector } from "../../components/workouts/LocationSelector";

function systemDateKey(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return values.year + "-" + values.month + "-" + values.day;
}

export function CalendarPage() {
  const [cycle, setCycle] = useState<ApiCycle | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [addActivity, setAddActivity] = useState<ActivityType>("STRENGTH");
  const [addDate, setAddDate] = useState(systemDateKey());
  const [addLocation, setAddLocation] = useState<Location>("GYM");
  const [addDuration, setAddDuration] = useState(60);
  const [adding, setAdding] = useState(false);

  const selectedWorkout = useMemo(
    () => cycle?.workouts.find((workout) => workout.id === selectedId) ?? null,
    [cycle, selectedId],
  );

  async function loadCycle() {
    setLoading(true);
    setError(null);
    try {
      setCycle(await getCurrentCycle());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "We could not load your calendar.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCycle();
  }, []);

  async function handleAddWorkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdding(true);
    setActionMessage(null);
    try {
      await createWorkout({
        activityType: addActivity,
        scheduledDate: new Date(addDate + "T12:00:00").toISOString(),
        location: addLocation,
        durationMinutes: addDuration,
      });
      await loadCycle();
      setActionMessage("Workout added without changing other sessions.");
    } catch (addError) {
      setActionMessage(
        addError instanceof Error
          ? addError.message
          : "The workout could not be added.",
      );
    } finally {
      setAdding(false);
    }
  }

  async function handleReschedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWorkout) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const nextDate = String(form.get("scheduledDate") ?? "");
    try {
      await rescheduleWorkout(
        selectedWorkout.id,
        new Date(nextDate + "T12:00:00").toISOString(),
      );
      await loadCycle();
      setActionMessage("Only this workout was moved.");
    } catch (rescheduleError) {
      setActionMessage(
        rescheduleError instanceof Error
          ? rescheduleError.message
          : "The workout could not be rescheduled.",
      );
    }
  }

  async function handleLocationChange(location: Location) {
    if (!selectedWorkout) {
      return;
    }
    try {
      await updateWorkoutLocation(selectedWorkout.id, location);
      await loadCycle();
      setActionMessage("This workout now uses the selected location.");
    } catch (locationError) {
      setActionMessage(
        locationError instanceof Error
          ? locationError.message
          : "The workout location could not be changed.",
      );
    }
  }

  async function handleCancel() {
    if (!selectedWorkout || !window.confirm("Cancel this workout?")) {
      return;
    }
    try {
      await cancelWorkout(selectedWorkout.id);
      await loadCycle();
      setActionMessage("This workout was cancelled. Other workouts were unchanged.");
    } catch (cancelError) {
      setActionMessage(
        cancelError instanceof Error
          ? cancelError.message
          : "The workout could not be cancelled.",
      );
    }
  }

  if (loading) {
    return <PageMessage message="Loading your four-week calendar…" />;
  }

  if (error) {
    return <PageMessage message={error} isError onRetry={() => void loadCycle()} />;
  }

  if (!cycle) {
    return (
      <PageMessage
        message="Create your training setup first, then GymBud will place your cycle here."
        action={
          <Link className="button-primary" to="/onboarding">
            Open setup
          </Link>
        }
      />
    );
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">
            {cycle.status} cycle
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gymbud-ink">
            Your training calendar
          </h1>
          <p className="mt-2 text-sm text-gymbud-muted">
            Four weeks, one clear place to adjust the plan.
          </p>
        </div>
        {cycle.reviewStatus?.reviewRequired ? (
          <Link
            className="focus-ring rounded-[var(--radius-control)] bg-gymbud-accent-strong px-4 py-3 text-sm font-semibold text-white"
            to={"/review/" + cycle.id}
          >
            Review cycle
          </Link>
        ) : null}
      </header>

      {actionMessage ? (
        <p role="status" className="rounded-[var(--radius-control)] bg-gymbud-surface-muted p-3 text-sm text-gymbud-ink">
          {actionMessage}
        </p>
      ) : null}

      <section className="cycle-gradient grid gap-4 rounded-[var(--radius-card)] border border-gymbud-border p-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p className="text-sm font-semibold text-gymbud-ink">Add a session</p>
          <p className="mt-1 text-sm text-gymbud-muted">
            Manual additions are marked extra and never move another workout.
          </p>
        </div>
        <form className="grid gap-3 sm:grid-cols-4" onSubmit={handleAddWorkout}>
          <label className="grid gap-1 text-xs font-semibold text-gymbud-ink">
            Activity
            <select
              className="min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
              value={addActivity}
              onChange={(event) => setAddActivity(event.target.value as ActivityType)}
            >
              <option value="STRENGTH">Strength</option>
              <option value="CARDIO">Cardio</option>
              <option value="SPORT">Sport</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-gymbud-ink">
            Date
            <input
              className="min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
              type="date"
              value={addDate}
              onChange={(event) => setAddDate(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-gymbud-ink">
            Minutes
            <input
              className="min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
              type="number"
              min={1}
              max={600}
              value={addDuration}
              onChange={(event) => setAddDuration(Number(event.target.value))}
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-gymbud-ink">
            Location
            <select
              className="min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
              value={addLocation}
              onChange={(event) => setAddLocation(event.target.value as Location)}
            >
              <option value="GYM">Gym</option>
              <option value="HOME">Home</option>
            </select>
          </label>
          <button
            className="focus-ring min-h-11 rounded-[var(--radius-control)] bg-gymbud-ink px-4 text-sm font-semibold text-white sm:col-span-4"
            disabled={adding}
            type="submit"
          >
            {adding ? "Adding…" : "Add workout"}
          </button>
        </form>
      </section>

      <CalendarGrid
        cycle={cycle}
        today={systemDateKey()}
        onSelectWorkout={(workout) => setSelectedId(workout.id)}
      />

      {selectedWorkout ? (
        <section className="glass-surface grid gap-4 rounded-[var(--radius-card)] border border-gymbud-border p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">
                Workout actions
              </p>
              <h2 className="mt-1 text-xl font-semibold text-gymbud-ink">
                {selectedWorkout.activityType} · {selectedWorkout.status}
              </h2>
            </div>
            <Link
              className="focus-ring rounded-[var(--radius-control)] border border-gymbud-border px-3 py-2 text-sm font-semibold text-gymbud-ink"
              to={"/workouts/" + selectedWorkout.id}
            >
              Open workout
            </Link>
          </div>
          {selectedWorkout.status === "PLANNED" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <form className="grid gap-2" onSubmit={handleReschedule}>
                <label className="grid gap-2 text-sm font-medium text-gymbud-ink">
                  Move this workout to
                  <input
                    className="min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
                    type="date"
                    name="scheduledDate"
                    defaultValue={selectedWorkout.scheduledDate.slice(0, 10)}
                  />
                </label>
                <button className="focus-ring min-h-11 rounded-[var(--radius-control)] bg-gymbud-accent-strong px-4 text-sm font-semibold text-white" type="submit">
                  Save new date
                </button>
              </form>
              <div className="grid gap-3">
                <LocationSelector
                  value={selectedWorkout.location}
                  onChange={(location) => void handleLocationChange(location)}
                />
                <button
                  className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-danger px-4 text-sm font-semibold text-gymbud-danger"
                  type="button"
                  onClick={() => void handleCancel()}
                >
                  Cancel this workout
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gymbud-muted">
              Completed and cancelled workouts are kept as history and cannot be
              silently changed here.
            </p>
          )}
        </section>
      ) : null}
    </main>
  );
}

function PageMessage({
  message,
  isError = false,
  onRetry,
  action,
}: {
  message: string;
  isError?: boolean;
  onRetry?: () => void;
  action?: ReactNode;
}) {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-2xl content-center gap-4 px-4 py-8 text-center">
      <div className="selected-empty-gradient rounded-[var(--radius-card)] border border-gymbud-border p-8">
        <p className={isError ? "text-gymbud-danger" : "text-gymbud-muted"}>
          {message}
        </p>
        {onRetry ? (
          <button className="button-primary mt-5" type="button" onClick={onRetry}>
            Try again
          </button>
        ) : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </main>
  );
}
