import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { ActivityType } from "@fitness/shared";
import {
  cancelWorkout,
  createWorkout,
  getCalendarWorkouts,
  getCurrentCycle,
  getWorkout,
  listExercises,
  rescheduleWorkout,
} from "../../api/client";
import type { ApiCycle, ApiExercise, ApiWorkout } from "../../api/contracts";
import { CalendarGrid } from "../../components/calendar/CalendarGrid";
import { WorkoutDetailsDrawer } from "../../components/calendar/WorkoutDetailsDrawer";
import type { CalendarWorkout } from "../../components/calendar/WorkoutCard";
import {
  currentMonthKey,
  getCalendarVisibleRange,
  isMonthKey,
  monthKeyFromDate,
  monthKeyToInitialDate,
  type CalendarVisibleRange,
} from "../../features/calendar/calendar-model";
import {
  StrengthPlanBuilder,
  type ManualPlannedExercise,
} from "../../components/workouts/StrengthPlanBuilder";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [cycle, setCycle] = useState<ApiCycle | null>(null);
  const [monthKey, setMonthKey] = useState(() => {
    const requestedMonth = searchParams.get("month");
    return isMonthKey(requestedMonth) ? requestedMonth : currentMonthKey();
  });
  const [visibleRange, setVisibleRange] =
    useState<CalendarVisibleRange | null>(null);
  const [workouts, setWorkouts] = useState<CalendarWorkout[]>([]);
  const [selectedSummary, setSelectedSummary] =
    useState<CalendarWorkout | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<ApiWorkout | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailExerciseNames, setDetailExerciseNames] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [addActivity, setAddActivity] = useState<ActivityType>("STRENGTH");
  const [addDate, setAddDate] = useState(systemDateKey());
  const [addDuration, setAddDuration] = useState(60);
  const [addExercises, setAddExercises] = useState<ApiExercise[]>([]);
  const [addPlannedExercises, setAddPlannedExercises] = useState<
    ManualPlannedExercise[]
  >([]);
  const [adding, setAdding] = useState(false);

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

  useEffect(() => {
    const requestedMonth = searchParams.get("month");
    const nextMonth = isMonthKey(requestedMonth)
      ? requestedMonth
      : currentMonthKey();
    if (nextMonth !== monthKey) {
      setMonthKey(nextMonth);
    }
  }, [monthKey, searchParams]);

  useEffect(() => {
    if (!visibleRange) {
      return;
    }

    let active = true;
    setCalendarLoading(true);
    setCalendarError(null);

    void getCalendarWorkouts(visibleRange.from, visibleRange.to)
      .then((nextWorkouts) => {
        if (active) {
          setWorkouts(nextWorkouts);
        }
      })
      .catch((loadError) => {
        if (active) {
          setCalendarError(
            loadError instanceof Error
              ? loadError.message
              : "We could not load the workouts for this month.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setCalendarLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [visibleRange]);

  useEffect(() => {
    if (!selectedSummary) {
      setSelectedWorkout(null);
      setDetailLoading(false);
      setDetailError(null);
      setDetailExerciseNames({});
      return;
    }

    let active = true;
    setSelectedWorkout(null);
    setDetailLoading(true);
    setDetailError(null);
    setDetailExerciseNames({});

    void getWorkout(selectedSummary.id)
      .then(async (workout) => {
        if (!active) {
          return;
        }
        setSelectedWorkout(workout);
        if (workout.activityType !== "STRENGTH") {
          return;
        }

        const exercises = await listExercises();
        if (active) {
          setDetailExerciseNames(
            Object.fromEntries(
              exercises.map((exercise) => [exercise.id, exercise.name]),
            ),
          );
        }
      })
      .catch((loadError) => {
        if (active) {
          setDetailError(
            loadError instanceof Error
              ? loadError.message
              : "We could not load this workout's details.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setDetailLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedSummary]);

  async function reloadCalendar() {
    if (!visibleRange) {
      return;
    }

    setCalendarLoading(true);
    setCalendarError(null);
    try {
      const nextWorkouts = await getCalendarWorkouts(
        visibleRange.from,
        visibleRange.to,
      );
      setWorkouts(nextWorkouts);
      setSelectedSummary((previousSummary) =>
        previousSummary
          ? nextWorkouts.find((workout) => workout.id === previousSummary.id) ?? null
          : null,
      );
    } catch (loadError) {
      setCalendarError(
        loadError instanceof Error
          ? loadError.message
          : "We could not load the workouts for this month.",
      );
    } finally {
      setCalendarLoading(false);
    }
  }

  function handleVisibleRangeChange(
    start: Date,
    endExclusive: Date,
    currentStart: Date,
  ) {
    const nextRange = getCalendarVisibleRange(start, endExclusive);
    setVisibleRange((previousRange) =>
      previousRange?.from === nextRange.from && previousRange.to === nextRange.to
        ? previousRange
        : nextRange,
    );
    setSelectedSummary(null);

    const nextMonth = monthKeyFromDate(currentStart);
    if (nextMonth !== monthKey) {
      setMonthKey(nextMonth);
      setSearchParams({ month: nextMonth }, { replace: true });
    }
  }

  useEffect(() => {
    if (addActivity !== "STRENGTH") {
      setAddExercises([]);
      setAddPlannedExercises([]);
      return;
    }

    let active = true;
    void listExercises()
      .then((exercises) => {
        if (active) {
          setAddExercises(exercises);
        }
      })
      .catch((loadError) => {
        if (active) {
          setActionMessage(
            loadError instanceof Error
              ? loadError.message
              : "The exercise list could not be loaded.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [addActivity]);

  async function handleAddWorkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      addActivity === "STRENGTH" &&
      (addPlannedExercises.length === 0 ||
        addPlannedExercises.some((exercise) => !exercise.exerciseId))
    ) {
      setActionMessage("Add a valid exercise plan before creating a strength workout.");
      return;
    }

    setAdding(true);
    setActionMessage(null);
    try {
      await createWorkout({
        activityType: addActivity,
        scheduledDate: new Date(addDate + "T12:00:00").toISOString(),
        durationMinutes: addDuration,
        ...(addActivity === "STRENGTH"
          ? { plannedExercises: addPlannedExercises }
          : {}),
      });
      await Promise.all([loadCycle(), reloadCalendar()]);
      setAddPlannedExercises([]);
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

  async function handleReschedule(nextDate: string) {
    if (!selectedSummary) {
      return;
    }

    try {
      await rescheduleWorkout(
        selectedSummary.id,
        new Date(nextDate + "T12:00:00").toISOString(),
      );
      await Promise.all([loadCycle(), reloadCalendar()]);
      setActionMessage("Only this workout was moved.");
    } catch (rescheduleError) {
      setActionMessage(
        rescheduleError instanceof Error
          ? rescheduleError.message
          : "The workout could not be rescheduled.",
      );
    }
  }

  async function handleCancel() {
    if (!selectedSummary || !window.confirm("Cancel this workout?")) {
      return;
    }
    try {
      await cancelWorkout(selectedSummary.id);
      await Promise.all([loadCycle(), reloadCalendar()]);
      setActionMessage("This workout was cancelled. Other workouts were unchanged.");
    } catch (cancelError) {
      setActionMessage(
        cancelError instanceof Error
          ? cancelError.message
          : "The workout could not be cancelled.",
      );
    }
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">
            {loading ? "Loading setup" : cycle ? cycle.status + " cycle" : "Calendar"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gymbud-ink">
            Your training calendar
          </h1>
          <p className="mt-2 text-sm text-gymbud-muted">
            Browse a month at a time, then open any workout for the full plan.
          </p>
        </div>
        {cycle && (cycle.reviewStatus?.reviewRequired || cycle.reviewAvailable) ? (
          <Link
            className="focus-ring rounded-[var(--radius-control)] bg-gymbud-accent-strong px-4 py-3 text-sm font-semibold text-white"
            to={"/review/" + cycle.id}
          >
            Review cycle
          </Link>
        ) : null}
      </header>

      {error ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] border border-gymbud-danger/30 bg-gymbud-surface p-3 text-sm text-gymbud-danger"
          role="alert"
        >
          <span>{error}</span>
          <button className="button-secondary focus-ring" type="button" onClick={() => void loadCycle()}>
            Try again
          </button>
        </div>
      ) : null}

      {actionMessage ? (
        <p role="status" className="rounded-[var(--radius-control)] bg-gymbud-surface-muted p-3 text-sm text-gymbud-ink">
          {actionMessage}
        </p>
      ) : null}

      {cycle?.status === "ACTIVE" ? (
        <section className="cycle-gradient grid gap-4 rounded-[var(--radius-card)] border border-gymbud-border p-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="text-sm font-semibold text-gymbud-ink">Add a session</p>
            <p className="mt-1 text-sm text-gymbud-muted">
              Add a plan without changing any other workout.
            </p>
          </div>
          <form className="grid gap-3 sm:grid-cols-3" onSubmit={handleAddWorkout}>
            <label className="grid gap-1 text-xs font-semibold text-gymbud-ink">
              Activity
              <select
                className="min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface px-3"
                value={addActivity}
                onChange={(event) => {
                  const activity = event.target.value as ActivityType;
                  setAddActivity(activity);
                  if (activity !== "STRENGTH") {
                    setAddPlannedExercises([]);
                  }
                }}
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
            {addActivity === "STRENGTH" ? (
              <div className="sm:col-span-3">
                <StrengthPlanBuilder
                  exercises={addExercises}
                  value={addPlannedExercises}
                  onChange={setAddPlannedExercises}
                />
              </div>
            ) : null}
            <button
              className="focus-ring min-h-11 rounded-[var(--radius-control)] bg-gymbud-ink px-4 text-sm font-semibold text-white sm:col-span-4"
              disabled={adding}
              type="submit"
            >
              {adding ? "Adding…" : "Add workout"}
            </button>
          </form>
        </section>
      ) : !loading && !cycle ? (
        <section className="selected-empty-gradient flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-card)] border border-gymbud-border p-5">
          <div>
            <p className="text-sm font-semibold text-gymbud-ink">Set up your training plan</p>
            <p className="mt-1 text-sm text-gymbud-muted">
              Finish setup to start adding workouts to this calendar.
            </p>
          </div>
          <Link className="button-primary" to="/onboarding">
            Open setup
          </Link>
        </section>
      ) : null}

      {calendarError ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] border border-gymbud-danger/30 bg-gymbud-surface p-3 text-sm text-gymbud-danger"
          role="alert"
        >
          <span>{calendarError}</span>
          <button className="button-secondary focus-ring" type="button" onClick={() => void reloadCalendar()}>
            Try again
          </button>
        </div>
      ) : null}

      {calendarLoading ? (
        <p className="text-sm text-gymbud-muted" role="status">
          Loading this month’s workouts…
        </p>
      ) : null}

      <CalendarGrid
        key={monthKey}
        workouts={workouts}
        initialDate={monthKeyToInitialDate(monthKey)}
        today={systemDateKey()}
        onSelectWorkout={setSelectedSummary}
        onVisibleRangeChange={handleVisibleRangeChange}
      />

      {selectedSummary ? (
        <WorkoutDetailsDrawer
          summary={selectedSummary}
          workout={selectedWorkout}
          loading={detailLoading}
          error={detailError}
          exerciseNames={detailExerciseNames}
          onClose={() => setSelectedSummary(null)}
          onReschedule={handleReschedule}
          onCancel={handleCancel}
        />
      ) : null}
    </main>
  );
}
