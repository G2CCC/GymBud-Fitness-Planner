import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { getCurrentCycle } from "../../api/client";
import type { ApiCycle } from "../../api/contracts";
import {
  buildProgressSummary,
  type ProgressSummary,
} from "../../features/progress/progress-model";

export function ProgressPage() {
  const [cycle, setCycle] = useState<ApiCycle | null>(null);
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadProgress() {
    setLoading(true);
    setError(null);
    try {
      const nextCycle = await getCurrentCycle();
      setCycle(nextCycle);
      setSummary(nextCycle ? buildProgressSummary(nextCycle.workouts) : null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "We could not load your progress.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProgress();
  }, []);

  if (loading) {
    return <ProgressMessage message="Loading your progress…" />;
  }

  if (error) {
    return (
      <ProgressMessage
        message={error}
        isError
        action={
          <button
            type="button"
            className="focus-ring rounded-[var(--radius-control)] bg-gymbud-accent-strong px-4 py-3 text-sm font-semibold text-white"
            onClick={() => void loadProgress()}
          >
            Try again
          </button>
        }
      />
    );
  }

  if (!cycle || !summary) {
    return (
      <ProgressMessage
        message="Your progress will appear after you create a training cycle."
        action={
          <Link
            className="focus-ring rounded-[var(--radius-control)] bg-gymbud-accent-strong px-4 py-3 text-sm font-semibold text-white"
            to="/onboarding"
          >
            Open setup
          </Link>
        }
      />
    );
  }

  const reviewRequired =
    cycle.reviewStatus?.reviewRequired === true ||
    cycle.reviewAvailable ||
    cycle.weeklyReview != null;

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">
            Cycle {cycle.cycleNumber ?? "draft"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gymbud-ink">
            Progress
          </h1>
          <p className="mt-2 text-sm text-gymbud-muted">
            Objective training volume for {formatDate(cycle.startDate)}–
            {formatDate(cycle.endDate)}.
          </p>
        </div>
        {reviewRequired ? (
          <Link
            className="focus-ring rounded-[var(--radius-control)] bg-gymbud-accent-strong px-4 py-3 text-sm font-semibold text-white"
            to={`/review/${cycle.id}`}
          >
            Review cycle
          </Link>
        ) : null}
      </header>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Cycle totals">
        <MetricCard label="Completed" value={`${summary.completedSessions} / ${summary.totalSessions}`} />
        <MetricCard label="Completion rate" value={`${Math.round(summary.completionRate * 100)}%`} />
        <MetricCard label="Planned" value={String(summary.plannedSessions)} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
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

      <p className="text-sm text-gymbud-muted">
        Rescheduled sessions: {summary.rescheduleCount}. Progress uses actual
        completed logs and does not merge data from older cycles.
      </p>
    </main>
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

function ProgressMessage({
  message,
  action,
  isError = false,
}: {
  message: string;
  action?: ReactNode;
  isError?: boolean;
}) {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-2xl content-center gap-4 px-4 py-8 text-center">
      <p className={isError ? "text-gymbud-danger" : "text-gymbud-muted"}>
        {message}
      </p>
      {action}
    </main>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
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
