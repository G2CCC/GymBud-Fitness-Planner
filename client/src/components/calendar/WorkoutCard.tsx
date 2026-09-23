import type { ActivityType, WorkoutStatus } from "@fitness/shared";
import type { ApiWorkout } from "../../api/contracts";

export type CalendarWorkout = Pick<
  ApiWorkout,
  | "id"
  | "activityType"
  | "scheduledDate"
  | "durationMinutes"
  | "status"
  | "completedAt"
  | "rescheduleCount"
> & {
  cycleId?: string;
};

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
  const activityKey = workout.activityType.toLowerCase();
  const statusClass =
    workout.status === "COMPLETED"
      ? "calendar-workout-card--completed"
      : workout.status === "CANCELLED"
        ? "calendar-workout-card--cancelled"
        : "";

  return (
    <button
      type="button"
      className={`calendar-workout-card calendar-workout-card--${activityKey} ${statusClass} motion-interactive focus-ring w-full rounded-[var(--radius-control)] border p-3 text-left shadow-sm`}
      data-activity={activityKey}
      data-status={workout.status.toLowerCase()}
      onClick={() => onSelect(workout)}
      aria-label={
        activityLabels[workout.activityType] +
        " workout on " +
        dateKey(workout.scheduledDate) +
        " (" +
        statusLabels[workout.status] +
        (overdue ? ", overdue" : "") +
        ")"
      }
    >
      <span className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-semibold">
            {activityLabels[workout.activityType]}
          </span>
          <span className="mt-1 block text-xs opacity-80">
            {workout.durationMinutes} min
          </span>
        </span>
        <span className="flex flex-wrap justify-end gap-1 text-[0.7rem] font-semibold">
          <span className="rounded-full bg-white/70 px-2 py-1">
            {statusLabels[workout.status]}
          </span>
          {overdue ? (
            <span className="rounded-full bg-white/70 px-2 py-1 text-gymbud-warning">
              Overdue
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
