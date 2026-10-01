import type { WorkoutStatus } from "@fitness/shared";
import type { ApiWorkout } from "../../api/contracts";
import {
  ActivityIdentity,
  getActivityDisplayName,
} from "../catalog/ActivityIdentity";

export type CalendarWorkout = Pick<
  ApiWorkout,
  | "id"
  | "activityType"
  | "scheduledDate"
  | "durationMinutes"
  | "status"
  | "completedAt"
  | "rescheduleCount"
  | "activityOption"
> & {
  cycleId?: string;
};

export type WorkoutCardProps = {
  workout: CalendarWorkout;
  today?: string;
  onSelect: (workout: CalendarWorkout) => void;
};

const statusLabels: Record<WorkoutStatus, string> = {
  PLANNED: "Planned",
  COMPLETED: "Completed",
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
      : "";
  const activityName = getActivityDisplayName(
    workout.activityType,
    workout.activityOption,
  );

  return (
    <button
      type="button"
      className={`calendar-workout-card calendar-workout-card--event calendar-workout-card--${activityKey} ${statusClass} motion-interactive focus-ring w-full rounded-[var(--radius-control)] border p-3 text-left shadow-sm`}
      data-activity={activityKey}
      data-status={workout.status.toLowerCase()}
      onClick={() => onSelect(workout)}
      aria-label={
        activityName +
        " workout on " +
        dateKey(workout.scheduledDate) +
        " (" +
        statusLabels[workout.status] +
        (overdue ? ", overdue" : "") +
        ")"
      }
    >
      <span className="calendar-workout-card__content">
        <span className="calendar-workout-card__identity">
          <ActivityIdentity
            activityType={workout.activityType}
            activityOption={workout.activityOption}
            size={16}
          />
        </span>
        <span className="calendar-workout-card__meta">
          <span className="calendar-workout-card__duration">
            {workout.durationMinutes} min
          </span>
          <span className="calendar-workout-card__badges">
            <span className="calendar-workout-card__status">
            {statusLabels[workout.status]}
            </span>
            {overdue ? (
              <span className="calendar-workout-card__overdue">Overdue</span>
            ) : null}
          </span>
        </span>
      </span>
    </button>
  );
}
