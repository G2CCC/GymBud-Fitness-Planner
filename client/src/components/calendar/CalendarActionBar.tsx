import { Link } from "react-router-dom";
import { ArrowRight, Plus, Sparkles } from "lucide-react";
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
      className="calendar-action-bar"
    >
      <div className="calendar-action-bar__primary">
        <button
          className="calendar-action-button calendar-action-button--add focus-ring"
          type="button"
          disabled={!cycleIsActive}
          aria-expanded={activePanel === "add"}
          onClick={() => onTogglePanel("add")}
        >
          <Plus size={18} aria-hidden="true" />
          <span>Add a session</span>
        </button>
        <button
          className="calendar-action-button calendar-action-button--generate focus-ring"
          type="button"
          disabled={!cycleIsActive}
          aria-expanded={activePanel === "generate"}
          onClick={() => onTogglePanel("generate")}
        >
          <Sparkles size={17} aria-hidden="true" />
          <span>Generate plan</span>
        </button>
      </div>
      <div className="calendar-action-bar__review">
        {!reviewIsAvailable ?<ReviewHint cycle={cycle} />:null}
        {reviewIsAvailable ? (
          <Link
            className="calendar-action-button calendar-action-button--review focus-ring"
            to={`/review/${cycle.id}`}
          >
            <span>Review cycle</span>
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        ) : (
          <button
            className="calendar-action-button calendar-action-button--review focus-ring"
            type="button"
            disabled
          >
            Review cycle
          </button>
        )}
        
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
        Review available in {status.daysUntilReview} {status.daysUntilReview === 1 ? "day" : "days"} · {formatShortDate(status.reviewAvailableOn)}
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
    timeZone: "UTC",
  }).format(new Date(value));
}
