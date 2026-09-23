import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  deletePlannedWorkout,
  confirmSingleDayPlan,
  generateSingleDayPlan,
  getCalendarWorkouts,
  getCurrentCycle,
  getWorkout,
  listExercises,
  rescheduleWorkout,
} from "../../api/client";
import type { ApiCycle, ApiPlanDraft, ApiWorkout } from "../../api/contracts";
import {
  CalendarActionBar,
  type CalendarPanelKey,
} from "../../components/calendar/CalendarActionBar";
import { AddSessionPanel } from "../../components/calendar/AddSessionPanel";
import { CalendarGrid } from "../../components/calendar/CalendarGrid";
import {
  GenerateDayPlanPanel,
  type GenerateDayPlanInput,
} from "../../components/calendar/GenerateDayPlanPanel";
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
function systemDateKey(): string {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
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
  const [activePanel, setActivePanel] = useState<CalendarPanelKey>(null);
  const [dayPlanDraft, setDayPlanDraft] = useState<ApiPlanDraft | null>(null);

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

  function handleTogglePanel(panel: Exclude<CalendarPanelKey, null>) {
    if (panel !== "generate") {
      setDayPlanDraft(null);
    }
    setActivePanel((current) => (current === panel ? null : panel));
  }

  async function handleSessionCreated() {
    await Promise.all([loadCycle(), reloadCalendar()]);
    setActivePanel(null);
  }

  async function handleGenerateDayPlan(input: GenerateDayPlanInput) {
    if (!cycle) {
      return;
    }

    setActionMessage(null);
    setDayPlanDraft(null);
    const draft = await generateSingleDayPlan(cycle.id, {
      scheduledDate: new Date(input.scheduledDate + "T12:00:00").toISOString(),
      focusAreas: input.focusAreas,
    });
    setDayPlanDraft(draft);
  }

  async function handleConfirmDayPlan(draft: ApiPlanDraft) {
    if (!cycle) {
      return;
    }

    await confirmSingleDayPlan(cycle.id, draft);
    await Promise.all([loadCycle(), reloadCalendar()]);
    setActivePanel(null);
    setDayPlanDraft(null);
    setActionMessage("The Strength day plan was added to your calendar.");
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

  async function handleDelete() {
    if (
      !selectedSummary ||
      !window.confirm("Delete this planned workout? This cannot be undone.")
    ) {
      return;
    }
    try {
      await deletePlannedWorkout(selectedSummary.id);
      await Promise.all([loadCycle(), reloadCalendar()]);
      setActionMessage("This workout was deleted.");
    } catch (deleteError) {
      setActionMessage(
        deleteError instanceof Error
          ? deleteError.message
          : "The workout could not be deleted.",
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

      {cycle ? (
        <>
          <CalendarActionBar
            cycle={cycle}
            activePanel={activePanel}
            onTogglePanel={handleTogglePanel}
          />
          {cycle.status === "ACTIVE" && activePanel === "add" ? (
            <AddSessionPanel
              onClose={() => setActivePanel(null)}
              onCreated={handleSessionCreated}
              onMessage={setActionMessage}
            />
          ) : null}
          {cycle.status === "ACTIVE" && activePanel === "generate" ? (
            <GenerateDayPlanPanel
              cycle={cycle}
              draft={dayPlanDraft}
              onClose={() => {
                setActivePanel(null);
                setDayPlanDraft(null);
              }}
              onGenerate={handleGenerateDayPlan}
              onConfirm={handleConfirmDayPlan}
              onDraftDiscard={() => setDayPlanDraft(null)}
            />
          ) : null}
        </>
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
          onDelete={handleDelete}
        />
      ) : null}
    </main>
  );
}
