import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { getCurrentCycle } from "../../api/client";
import type { ApiCycle, ApiWorkout } from "../../api/contracts";
import {
  buildTodayViewModel,
  dateKeyFromIso,
  formatDateKey,
  systemDateKey,
  type TodayViewModel,
} from "../../features/today/today-model";
import type { ProgressSummary } from "../../features/progress/progress-model";

const todayMainClass =
  "mx-auto grid max-w-5xl gap-6 px-4 py-6 pb-28 sm:px-8 lg:pb-8";

const activityLabels = {
  STRENGTH: "Strength",
  CARDIO: "Cardio",
  SPORT: "Sport",
} as const;

const statusLabels = {
  PLANNED: "Planned",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
} as const;

export function TodayPage() {
  const [cycle, setCycle] = useState<ApiCycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const loadCycle = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextCycle = await getCurrentCycle();
      if (mounted.current) {
        setCycle(nextCycle);
      }
    } catch (loadError) {
      if (mounted.current) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "We could not load today’s plan.",
        );
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void loadCycle();

    return () => {
      mounted.current = false;
    };
  }, [loadCycle]);

  if (loading) {
    return <TodayMessage busy message="Loading today’s plan…" />;
  }

  if (error) {
    return (
      <TodayMessage
        error
        message={error}
        action={
          <button
            type="button"
            className="button-primary focus-ring justify-self-center"
            onClick={() => void loadCycle()}
          >
            Try again
          </button>
        }
      />
    );
  }

  const viewModel = buildTodayViewModel(cycle, new Date());

  if (viewModel.kind === "NO_CYCLE") {
    return <NoCycleState />;
  }

  if (viewModel.kind === "DRAFT") {
    return <DraftCycleState />;
  }

  if (viewModel.kind === "CLOSED") {
    return <ClosedCycleState model={viewModel} />;
  }

  return <ActiveCycleState model={viewModel} />;
}

function NoCycleState() {
  return (
    <main className={todayMainClass}>
      <PageHeader
        eyebrow="Training dashboard"
        title="Today"
        description="Your next useful training action will appear here."
      />
      <EmptyPanel
        title="No active cycle yet"
        message="Create your profile and first training cycle to start planning workouts."
        action={
          <Link className="button-primary focus-ring" to="/onboarding">
            Open setup
          </Link>
        }
      />
    </main>
  );
}

function DraftCycleState() {
  return (
    <main className={todayMainClass}>
      <PageHeader
        eyebrow="Setup in progress"
        title="Today"
        description="Your cycle is saved, but the setup is not finished yet."
      />
      <EmptyPanel
        title="Finish setting up your cycle"
        message="Choose an AI plan or add your own workouts before training begins."
        action={
          <Link className="button-primary focus-ring" to="/onboarding">
            Continue setup
          </Link>
        }
      />
    </main>
  );
}

function ActiveCycleState({ model }: { model: Extract<TodayViewModel, { kind: "READY" | "REVIEW_REQUIRED" }> }) {
  const isReviewRequired = model.kind === "REVIEW_REQUIRED";
  const todayKey = systemDateKey();

  return (
    <main className={todayMainClass}>
      <PageHeader
        eyebrow={
          model.cycle.cycleNumber === null
            ? "Current cycle"
            : `Cycle ${model.cycle.cycleNumber}`
        }
        title="Today"
        description={`Today is ${formatDateKey(todayKey)}`}
        details={`Cycle dates: ${formatDateKey(model.cycle.startDate)} – ${formatDateKey(model.cycle.endDate)}`}
        action={
          isReviewRequired ? undefined : (
            <Link className="button-primary focus-ring" to="/calendar">
              View full calendar
            </Link>
          )
        }
      />

      {isReviewRequired ? (
        <section
          className="rounded-[var(--radius-card)] border border-gymbud-warning/40 bg-gymbud-warning/10 p-5"
          aria-labelledby="review-required-heading"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-warning">
            Attention needed
          </p>
          <h2
            id="review-required-heading"
            className="mt-2 text-xl font-semibold text-gymbud-ink"
          >
            Review required
          </h2>
          <p className="mt-2 text-sm leading-6 text-gymbud-ink">
            Review this cycle before starting the next planning step. Your
            current workout history remains available below.
          </p>
          <Link
            className="focus-ring mt-4 inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-gymbud-ink px-4 py-3 text-sm font-semibold text-white"
            to={`/review/${model.cycle.id}`}
          >
            {model.reviewLabel}
          </Link>
        </section>
      ) : null}

      <CycleSummary summary={model.summary} />
      <WorkoutSection
        todayWorkouts={model.todayWorkouts}
        focusWorkout={model.kind === "READY" ? model.focusWorkout : null}
        todayKey={todayKey}
        showRestDayFocus={!isReviewRequired}
      />
    </main>
  );
}

function ClosedCycleState({
  model,
}: {
  model: Extract<TodayViewModel, { kind: "CLOSED" }>;
}) {
  return (
    <main className={todayMainClass}>
      <PageHeader
        eyebrow={
          model.cycle.cycleNumber === null
            ? "History"
            : `Cycle ${model.cycle.cycleNumber}`
        }
        title="Cycle complete"
        description={`${formatDateKey(model.cycle.startDate)} – ${formatDateKey(model.cycle.endDate)}`}
      />
      <CycleSummary summary={model.summary} />
      <EmptyPanel
        title="Ready for your next cycle?"
        message="Start a new setup flow when you are ready to plan your next week."
        action={
          <Link className="button-primary focus-ring" to="/onboarding">
            Start next cycle
          </Link>
        }
      />
    </main>
  );
}

function PageHeader({
  eyebrow,
  title,
  description,
  details,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  details?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gymbud-ink">
          {title}
        </h1>
        <p className="mt-2 text-sm text-gymbud-muted">{description}</p>
        {details ? (
          <p className="mt-1 text-sm text-gymbud-muted">{details}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}

function CycleSummary({ summary }: { summary: ProgressSummary }) {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Cycle progress">
        <MetricCard
          label="Completed sessions"
          value={`${summary.completedSessions} / ${summary.totalSessions}`}
        />
        <MetricCard
          label="Completion rate"
          value={`${Math.round(summary.completionRate * 100)}%`}
        />
        <MetricCard label="Cancelled sessions" value={String(summary.cancelledSessions)} />
        <MetricCard label="Rescheduled sessions" value={String(summary.rescheduleCount)} />
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Activity totals">
        <ActivityCard
          title="Strength"
          rows={[
            ["Sessions", String(summary.activityTotals.strength.completedWorkouts)],
            ["Sets", String(summary.activityTotals.strength.completedSets)],
            ["Actual reps", String(summary.activityTotals.strength.actualReps)],
            ["Weighted volume", formatWeight(summary.activityTotals.strength.weightedVolume)],
          ]}
        />
        <ActivityCard
          title="Cardio"
          rows={[
            ["Sessions", String(summary.activityTotals.cardio.completedWorkouts)],
            ["Duration", `${summary.activityTotals.cardio.actualDurationMinutes} min`],
            ["Distance", `${formatDecimal(summary.activityTotals.cardio.actualDistanceKm)} km`],
          ]}
        />
        <ActivityCard
          title="Sport"
          rows={[
            ["Sessions", String(summary.activityTotals.sport.completedWorkouts)],
            ["Duration", `${summary.activityTotals.sport.actualDurationMinutes} min`],
          ]}
        />
      </section>
    </>
  );
}

function WorkoutSection({
  todayWorkouts,
  focusWorkout,
  todayKey,
  showRestDayFocus,
}: {
  todayWorkouts: readonly ApiWorkout[];
  focusWorkout: ApiWorkout | null;
  todayKey: string;
  showRestDayFocus: boolean;
}) {
  if (todayWorkouts.length > 0) {
    return (
      <section className="grid gap-4" aria-labelledby="today-workouts-heading">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">
            Your plan
          </p>
          <h2 id="today-workouts-heading" className="mt-2 text-2xl font-semibold text-gymbud-ink">
            Today's workouts
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {todayWorkouts.map((workout) => (
            <WorkoutActionCard key={workout.id} workout={workout} todayKey={todayKey} />
          ))}
        </div>
      </section>
    );
  }

  if (showRestDayFocus && focusWorkout) {
    return (
      <section className="grid gap-4" aria-labelledby="next-workout-heading">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">
            Keep momentum
          </p>
          <h2 id="next-workout-heading" className="mt-2 text-2xl font-semibold text-gymbud-ink">
            Next workout
          </h2>
        </div>
        <WorkoutActionCard workout={focusWorkout} todayKey={todayKey} />
      </section>
    );
  }

  return (
    <EmptyPanel
      title={showRestDayFocus ? "No planned workouts" : "No workout scheduled today"}
      message={
        showRestDayFocus
          ? "Add a workout in your calendar when you are ready."
          : "Your current workout history is still available in the calendar."
      }
      action={
        <Link className="button-primary focus-ring" to="/calendar">
          View full calendar
        </Link>
      }
    />
  );
}

function WorkoutActionCard({
  workout,
  todayKey,
}: {
  workout: ApiWorkout;
  todayKey: string;
}) {
  const workoutDateKey = dateKeyFromIso(workout.scheduledDate);
  const overdue = workout.status === "PLANNED" && workoutDateKey < todayKey;
  const actionLabel =
    workout.status === "PLANNED"
      ? overdue
        ? "Open overdue workout"
        : "Start workout"
      : "View workout";

  return (
    <article className="motion-interactive rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gymbud-ink">
            {activityLabels[workout.activityType]}
          </h3>
          <p className="mt-1 text-sm text-gymbud-muted">
            {formatDateKey(workout.scheduledDate)} · {workout.durationMinutes} min
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 text-xs font-semibold">
          <span className="rounded-full bg-gymbud-surface-muted px-2 py-1 text-gymbud-ink">
            Status: {statusLabels[workout.status]}
          </span>
          {overdue ? (
            <span className="rounded-full bg-gymbud-warning/15 px-2 py-1 text-gymbud-warning">
              Overdue
            </span>
          ) : null}
        </div>
      </div>
      <Link
        className="focus-ring mt-5 inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-gymbud-border px-4 py-3 text-sm font-semibold text-gymbud-ink"
        to={`/workouts/${workout.id}`}
      >
        {actionLabel}
      </Link>
    </article>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-4 shadow-sm">
      <p className="text-sm text-gymbud-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gymbud-ink">{value}</p>
    </article>
  );
}

function ActivityCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <article className="rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-gymbud-ink">{title}</h2>
      <dl className="mt-4 grid gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 text-sm">
            <dt className="text-gymbud-muted">{label}</dt>
            <dd className="font-semibold text-gymbud-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function EmptyPanel({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action: ReactNode;
}) {
  return (
    <section className="selected-empty-gradient grid gap-3 rounded-[var(--radius-card)] border border-gymbud-border p-6">
      <h2 className="text-xl font-semibold text-gymbud-ink">{title}</h2>
      <p className="max-w-2xl text-sm leading-6 text-gymbud-muted">{message}</p>
      <div>{action}</div>
    </section>
  );
}

function TodayMessage({
  message,
  action,
  busy = false,
  error = false,
}: {
  message: string;
  action?: ReactNode;
  busy?: boolean;
  error?: boolean;
}) {
  return (
    <main
      className={`${todayMainClass} min-h-[calc(100vh-8rem)] content-center text-center`}
      aria-busy={busy ? "true" : undefined}
    >
      <h1 className="text-3xl font-semibold tracking-tight text-gymbud-ink">Today</h1>
      <p
        className={error ? "text-gymbud-danger" : "text-gymbud-muted"}
        role={error ? "alert" : "status"}
      >
        {message}
      </p>
      {action}
    </main>
  );
}

function formatDecimal(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatWeight(value: { KG: number; LB: number }): string {
  const parts = [];
  if (value.KG > 0) parts.push(`${formatDecimal(value.KG)} kg`);
  if (value.LB > 0) parts.push(`${formatDecimal(value.LB)} lb`);
  return parts.length > 0 ? parts.join(" / ") : "—";
}
