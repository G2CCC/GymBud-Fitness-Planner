import type { ActivityType, WorkoutStatus } from "@fitness/shared";
import type { ApiWorkout } from "../../api/contracts";

export type CalendarWorkout = ApiWorkout;

export type WorkoutCardProps = {
  workout: CalendarWorkout;
  today?: string;
  onSelect: (workout: CalendarWorkout) => void;
};

const activityLabels: Record<ActivityType, string> = {
  STRENGTH: "Strength",
  CARDIO: "Cardio",
  SPORT: "Sport",
};

const statusLabels: Record<WorkoutStatus, string> = {
  PLANNED: "Planned",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function dateKey(value: string): string {
  return value.slice(0, 10);
}

function isOverdue(workout: CalendarWorkout, today: string): boolean {
  return (
    workout.status === "PLANNED" &&
    dateKey(workout.scheduledDate) < dateKey(today)
  );
}

export function WorkoutCard({
  workout,
  today = new Date().toISOString(),
  onSelect,
}: WorkoutCardProps) {
  const overdue = isOverdue(workout, today);

  return (
    <button
      type="button"
      className="motion-interactive focus-ring w-full rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-surface p-4 text-left shadow-sm"
      onClick={() => onSelect(workout)}
      aria-label={
        activityLabels[workout.activityType] +
        " workout on " +
        dateKey(workout.scheduledDate)
      }
    >
      <span className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-semibold text-gymbud-ink">
            {activityLabels[workout.activityType]}
          </span>
          <span className="mt-1 block text-xs text-gymbud-muted">
            {workout.location} · {workout.durationMinutes} min
          </span>
        </span>
        <span className="flex flex-wrap justify-end gap-1 text-[0.7rem] font-semibold">
          <span className="rounded-full bg-gymbud-surface-muted px-2 py-1 text-gymbud-ink">
            {statusLabels[workout.status]}
          </span>
          {overdue ? (
            <span className="rounded-full bg-gymbud-warning/15 px-2 py-1 text-gymbud-warning">
              Overdue
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
