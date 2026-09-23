import { Link } from "react-router-dom";
import type { ApiCycle } from "../../api/contracts";

export type CalendarPanelKey = "add" | "generate" | null;

export type CalendarActionBarProps = {
  cycle: ApiCycle;
  activePanel: CalendarPanelKey;
  onTogglePanel: (panel: Exclude<CalendarPanelKey, null>) => void;
};

export function CalendarActionBar({
  cycle,
  activePanel,
  onTogglePanel,
}: CalendarActionBarProps) {
  const cycleIsActive = cycle.status === "ACTIVE";
  const reviewIsAvailable = cycle.reviewAvailable || cycle.weeklyReview !== null;

  return (
    <section
      aria-label="Calendar actions"
      className="flex flex-wrap items-start gap-3 rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-4"
    >
      <button
        className="focus-ring min-h-11 rounded-[var(--radius-control)] bg-gymbud-ink px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gymbud-surface-muted disabled:text-gymbud-muted"
        type="button"
        disabled={!cycleIsActive}
        aria-expanded={activePanel === "add"}
        onClick={() => onTogglePanel("add")}
      >
        Add a session
      </button>
      <button
        className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-ink px-4 text-sm font-semibold text-gymbud-ink disabled:cursor-not-allowed disabled:border-gymbud-border disabled:text-gymbud-muted"
        type="button"
        disabled={!cycleIsActive}
        aria-expanded={activePanel === "generate"}
        onClick={() => onTogglePanel("generate")}
      >
        Generate plan
      </button>
      <div className="grid justify-items-start gap-1">
        {reviewIsAvailable ? (
          <Link
            className="focus-ring min-h-11 rounded-[var(--radius-control)] bg-gymbud-accent-strong px-4 py-3 text-sm font-semibold text-white"
            to={`/review/${cycle.id}`}
          >
            Review cycle
          </Link>
        ) : (
          <button
            className="focus-ring min-h-11 cursor-not-allowed rounded-[var(--radius-control)] bg-gymbud-surface-muted px-4 text-sm font-semibold text-gymbud-muted"
            type="button"
            disabled
          >
            Review cycle
          </button>
        )}
        <ReviewHint cycle={cycle} />
      </div>
    </section>
  );
}

function ReviewHint({ cycle }: { cycle: ApiCycle }) {
  const status = cycle.reviewStatus;

  if (status?.blockedReason === "PLANNED_WORKOUTS_REMAINING") {
    const noun = status.plannedWorkoutCount === 1 ? "session remains" : "sessions remain";
    return (
      <p className="max-w-xs text-xs text-gymbud-muted">
        {status.plannedWorkoutCount} planned {noun}. Complete or delete them before review.
      </p>
    );
  }

  if (status && status.daysUntilReview > 0) {
    return (
      <p className="max-w-xs text-xs text-gymbud-muted">
        Available in {status.daysUntilReview} {status.daysUntilReview === 1 ? "day" : "days"} · {formatShortDate(status.reviewAvailableOn)}
      </p>
    );
  }

  if (cycle.status === "DRAFT") {
    return <p className="max-w-xs text-xs text-gymbud-muted">Activate a cycle before reviewing it.</p>;
  }

  return null;
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
